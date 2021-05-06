import EventEmitter, { EventArgs, EventNames, ValidEventTypes } from 'eventemitter3';
import WebSocket, { CloseEvent, MessageEvent } from 'ws';
import {
  GatewayCloseCodes, GatewayDispatchEvents, GatewayIdentifyData, GatewayOPCodes, GatewayReceivePayload, GatewayResumeData,
} from 'discord-api-types/gateway';
import { platform } from 'os';
import * as erlpack from 'erlpack';
import Timer = NodeJS.Timer;

export type GatewayIdentifyDataPartial = Partial<GatewayIdentifyData> & {
  intents: number;
};

export class GatewayShard extends EventEmitter {
  private token: string;

  private id: number | undefined;

  private totalShards: number | undefined;

  private websocket: WebSocket | undefined;

  private url: string | undefined;

  private protocols: string[] | undefined;

  public heartbeatInterval?: Timer;

  public latency: number = 0;

  public readyAt: number = 0;

  public resumedAt: number = 0;

  public seq: number = 0;

  public sessionID?: string;

  private lastHeartbeatSent: number = 0;

  private identifyData?: GatewayIdentifyDataPartial;

  constructor(token: string, id?: number, totalShards?: number) {
    super();
    this.token = token;
    this.id = id;
    this.totalShards = totalShards;
  }

  async connect(url: string, protocols?: string[]): Promise<void> {
    this.url = url;
    this.protocols = protocols;
    this.websocket = new WebSocket(this.url, protocols);

    this.websocket.addEventListener('close', (event) => {
      this.onWebsocketClose(event);
    });
    this.websocket.addEventListener('error', (event) => {
      this.onWebsocketError(event);
    });
    this.websocket.addEventListener('message', (event) => {
      this.onWebsocketMessage(event);
    });

    return new Promise((resolve) => {
      this.websocket!.addEventListener('open', resolve);
    });
  }

  disconnect(code: number, reason: string) {
    if (!this.websocket) {
      throw new Error('Unable to disconnect since it was not connected.');
    }
    this.websocket.close(code, reason);
  }

  private reset(soft?: boolean) {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
    this.websocket = undefined;

    if (!soft) {
      this.latency = 0;
      this.seq = 0;
      this.sessionID = undefined;
    }
  }

  public async onWebsocketClose(event: CloseEvent): Promise<void> {
    let canReconnect: boolean = false;
    let canResume: boolean = false;

    switch (event.code) {
      case 0: // ?
      case 1001: // ?
      case 1006: // Maybe (?)
      case GatewayCloseCodes.UnknownError: {
        canResume = true;
        canReconnect = true;
        break;
      }
      case GatewayCloseCodes.UnknownOpCode:
      case GatewayCloseCodes.DecodeError:
      case GatewayCloseCodes.InvalidSeq:
      case GatewayCloseCodes.RateLimited:
      case GatewayCloseCodes.SessionTimedOut: {
        canReconnect = true;
        break;
      }
      default: {
        canResume = false;
        canReconnect = false;
        break;
      }
    }

    this.emit('internal:disconnect', canResume, canReconnect, event);
    this.reset(canResume);

    if (canReconnect && this.url) {
      await this.connect(this.url, this.protocols);
      this.resumeOrIdentify(canResume, this.identifyData);
    }
  }

  onWebsocketError(event: unknown) {
    this.emit('internal:error', event);
  }

  onWebsocketMessage(event: MessageEvent) {
    const payload = GatewayShard.decodePayload<GatewayReceivePayload>(event.data as Buffer);

    this.emit('internal:receive', JSON.stringify(payload));

    this.emit(`opcode:${payload.op}`, payload);

    switch (payload.op) {
      case GatewayOPCodes.Dispatch: {
        this.seq = payload.s;
        switch (payload.t) {
          case GatewayDispatchEvents.Ready: {
            this.id ??= payload.d.shard?.[0];
            this.readyAt = Date.now();
            this.sessionID = payload.d.session_id;
            break;
          }

          case GatewayDispatchEvents.Resumed: {
            this.resumedAt = Date.now();
            this.emit('internal:resumed', this.resumedAt);
            break;
          }

          default: {
            break;
          }
        }
        this.emit(payload.t, payload.d);
        break;
      }

      case GatewayOPCodes.InvalidSession: {
        this.resumeOrIdentify(payload.d, this.identifyData);
        break;
      }

      case GatewayOPCodes.Hello: {
        const delay = payload.d.heartbeat_interval;
        this.heartbeatInterval = setInterval(() => {
          this.heartbeat();
        }, delay);
        break;
      }

      case GatewayOPCodes.HeartbeatAck: {
        this.latency = Date.now() - this.lastHeartbeatSent;
        break;
      }

      default: {
        break;
      }
    }
  }

  private heartbeat() {
    this.lastHeartbeatSent = Date.now();
    this.sendPayload(GatewayOPCodes.Heartbeat, this.seq);
  }

  private identify(data: GatewayIdentifyDataPartial) {
    this.identifyData = data;
    const payload: Partial<GatewayIdentifyDataPartial> = {
      properties: {
        $browser: 'Skycord',
        $device: 'Skycord',
        $os: `${platform()}`,
      },
      shard: data.shard ?? (
        this.id !== undefined && this.totalShards !== undefined ? [this.id, this.totalShards] : undefined
      ),
      token: this.token,
      ...data,
    };
    this.sendPayload(GatewayOPCodes.Identify, payload);
  }

  private resume() {
    if (!this.sessionID) {
      throw new Error('Cannot resume since no session id is available.');
    }
    const payload: GatewayResumeData = {
      seq: this.seq,
      session_id: this.sessionID,
      token: this.token,
    };
    this.sendPayload(GatewayOPCodes.Resume, payload);
  }

  public resumeOrIdentify(canResume?: boolean, identifyData?: GatewayIdentifyDataPartial) {
    if (canResume && this.sessionID) {
      this.resume();
    } else if (identifyData) {
      this.identify(identifyData);
    } else {
      throw new Error('Failed to resume or identify.');
    }
  }

  private sendPayload(opcode: number, data: unknown) {
    if (!this.websocket) {
      throw new Error('No websocket exists, unable to send the payload.');
    }
    this.emit('internal:send', JSON.stringify({
      d: data,
      op: opcode,
    }));
    this.websocket.send(GatewayShard.encodePayload({
      d: data,
      op: opcode,
    }));
  }

  private static encodePayload(payload: unknown) {
    return erlpack.pack(payload);
  }

  private static decodePayload<T = unknown>(payload: string | Buffer): T {
    let data = payload;
    if (!Buffer.isBuffer(payload)) {
      data = Buffer.from(new Uint8Array(data as Uint8Array));
    }
    return erlpack.unpack(data as Buffer);
  }

  emit(event: EventNames<ValidEventTypes>, ...args: EventArgs<ValidEventTypes, EventNames<ValidEventTypes>>): boolean {
    super.emit('*', event, ...args);
    return super.emit(event, ...args);
  }
}
