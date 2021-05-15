import WebSocket, { CloseEvent, MessageEvent } from 'ws';
import { Inflate } from 'zlib-sync';
import EventEmitter, { EventArgs, EventNames, ValidEventTypes } from 'eventemitter3';
import * as zlib from 'zlib';
import {
  GatewayCloseCodes, GatewayDispatchEvents, GatewayOPCodes, GatewayReceivePayload,
} from 'discord-api-types';
import type { GatewayClient } from './GatewayClient';
import type { ClientType } from '../client/Client';
import Timer = NodeJS.Timer;

export class GatewayShard extends EventEmitter {
  public readonly client: ClientType;

  public readonly gatewayClient: GatewayClient;

  public readonly shardId: number;

  private inflate: Inflate | undefined;

  private websocket: WebSocket | undefined;

  private sequence: number;

  private sessionId: string | undefined;

  private lastHeartbeatAcked: boolean;

  private heartbeatInterval: Timer | undefined;

  public userId: string | undefined;

  constructor(client: ClientType, gatewayClient: GatewayClient, shardId: number) {
    super();
    this.client = client;
    this.gatewayClient = gatewayClient;
    this.shardId = shardId;
    this.sequence = -1;
    this.lastHeartbeatAcked = false;
  }

  connect(): void {
    this.disconnect();
    this.inflate = new Inflate({
      chunkSize: 65535,
    });
    this.websocket = new WebSocket(`${this.gatewayClient.gatewayEndpoint}?v=${this.gatewayClient.gatewayClientOptions.version}&encoding=json&compress=zlib-stream`);
    this.websocket.onmessage = this.onMessage.bind(this);
    this.websocket.onclose = this.onClose.bind(this);
  }

  disconnect(closeCode: number = 4009): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.websocket) {
      try {
        this.websocket.close(closeCode);
      } catch (e) {
        // Ignore error
      }
      this.websocket = undefined;
    }
  }

  send(data: any): void {
    if (this.websocket) {
      this.websocket.send(JSON.stringify(data));
    }
  }

  onMessage(messageEvent: MessageEvent): void {
    const data: Buffer = messageEvent.data instanceof ArrayBuffer ? Buffer.from(messageEvent.data) : messageEvent.data as Buffer;
    const flush = data.length >= 4 && data.readUInt32BE(data.length - 4) === 0x0000FFFF;
    this.inflate!.push(data, flush && zlib.constants.Z_SYNC_FLUSH);
    if (!flush) {
      return;
    }
    this.onPayload(JSON.parse(this.inflate!.result as string));
  }

  onClose(closeEvent: CloseEvent): void {
    switch (closeEvent.code) {
      case 1000:
      case 4006: // Session no longer valid
      case GatewayCloseCodes.InvalidSeq:
      case GatewayCloseCodes.SessionTimedOut:
        this.gatewayClient.spawnShard(this.shardId);
        break;
      case GatewayCloseCodes.InvalidShard:
      case GatewayCloseCodes.ShardingRequired:
      case GatewayCloseCodes.InvalidIntents:
      case GatewayCloseCodes.DisallowedIntents:
        throw new Error(closeEvent.reason);
      default:
        this.connect();
        break;
    }
  }

  onPayload(gatewayPayload: GatewayReceivePayload): void {
    if (gatewayPayload.s > this.sequence) {
      this.sequence = gatewayPayload.s;
    }

    this.emit(`opcode:${gatewayPayload.op}`, gatewayPayload);

    switch (gatewayPayload.op) {
      case GatewayOPCodes.Hello:
        this.lastHeartbeatAcked = true;
        this.heartbeatInterval = setInterval(() => {
          if (!this.lastHeartbeatAcked) {
            this.connect();
          } else {
            this.lastHeartbeatAcked = false;
            this.send({
              op: GatewayOPCodes.Heartbeat,
              d: this.sequence,
            });
          }
        }, gatewayPayload.d.heartbeat_interval);
        if (this.sessionId) {
          this.send({
            op: GatewayOPCodes.Resume,
            d: {
              token: this.gatewayClient.gatewayClientOptions.token,
              session_id: this.sessionId,
              seq: this.sequence,
            },
          });
        } else {
          this.send({
            op: GatewayOPCodes.Identify,
            d: {
              token: this.gatewayClient.gatewayClientOptions.token,
              intents: this.gatewayClient.gatewayClientOptions.intents,
              properties: {
                $os: process.platform,
                $device: 'Skycord',
                $browser: 'Skycord',
              },
              shard: [this.shardId, this.gatewayClient.determinedTotalShards],
            },
          });
        }
        break;
      case GatewayOPCodes.Reconnect:
        if (this.sessionId) {
          this.connect();
        } else {
          this.gatewayClient.spawnShard(this.shardId);
        }
        break;
      case GatewayOPCodes.InvalidSession:
        if (gatewayPayload.d && this.sessionId) {
          this.send({
            op: GatewayOPCodes.Resume,
            d: {
              token: this.gatewayClient.gatewayClientOptions.token,
              session_id: this.sessionId,
              seq: this.sequence,
            },
          });
        } else {
          this.gatewayClient.spawnShard(this.shardId);
        }
        break;
      case GatewayOPCodes.Dispatch:
        switch (gatewayPayload.t) {
          case GatewayDispatchEvents.Ready:
            this.sessionId = gatewayPayload.d.session_id;
            this.userId = gatewayPayload.d.user.id;
            this.emit(gatewayPayload.t, gatewayPayload.d);
            break;
          default: {
            this.emit(gatewayPayload.t, gatewayPayload.d);
            break;
          }
        }
        break;
      case GatewayOPCodes.HeartbeatAck:
        this.lastHeartbeatAcked = true;
        break;
      default:
        break;
    }
  }

  emit(event: EventNames<ValidEventTypes>, ...args: EventArgs<ValidEventTypes, EventNames<ValidEventTypes>>): boolean {
    this.gatewayClient.emit(event, ...args);
    return super.emit(event, ...args);
  }
}
