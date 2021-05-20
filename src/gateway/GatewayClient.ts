import EventEmitter from 'eventemitter3';
import { GatewayOPCodes, GatewayRequestGuildMembersData } from 'discord-api-types';
import type { ClientType } from '../client/Client';
import { wait } from '../utils/TimerUtils';
import { GatewayShard } from './GatewayShard';
import { RestRoutes } from '../rest/RestRoutes';
import { GatewayIntentsBitfield } from '../utils/Constants';

export interface GatewayClientOptions {

  version: number;

  intents: number;

  token: string | undefined;

  totalShards: number | undefined;
}

export const defaultGatewayClientOptions: GatewayClientOptions = {
  version: 9,
  intents: new GatewayIntentsBitfield(['GUILDS', 'GUILD_MESSAGES']).value,
  token: undefined,
  totalShards: undefined,
};

export class GatewayClient extends EventEmitter {
  public readonly client: ClientType;

  public readonly gatewayClientOptions: GatewayClientOptions;

  public gatewayEndpoint: string | undefined;

  public maxConcurrency: number;

  public shards: GatewayShard[];

  private shardSpawnQueue: Promise<void>;

  private remaining: number;

  public determinedTotalShards = 1;

  constructor(client: ClientType, gatewayClientOptions: GatewayClientOptions) {
    super();
    this.client = client;
    this.gatewayClientOptions = gatewayClientOptions;
    this.maxConcurrency = Infinity;
    this.shards = [];
    this.shardSpawnQueue = Promise.resolve();
    this.remaining = 1;
  }

  public spawnShard(shardId: number): void {
    this.shardSpawnQueue = this.shardSpawnQueue.then(async () => {
      if (this.shards[shardId]) {
        this.shards[shardId].canConnect = false;
        this.shards[shardId].disconnect();
      }
      if (this.remaining <= 0) {
        await wait(5000);
        this.remaining = this.maxConcurrency;
      }
      this.shards[shardId] = new GatewayShard(this.client, this, shardId);
      this.shards[shardId].connect();
      this.remaining -= 1;
    });
  }

  public async connect(shardIds?: number[]): Promise<void> {
    this.determinedTotalShards = this.gatewayClientOptions.totalShards ?? 1;
    if (!this.gatewayEndpoint) {
      const response = await this.client.rest.request<{
        shards: number;
        url: string;
        session_start_limit: {
          max_concurrency: number;
        };
      }>(RestRoutes.GATEWAY_BOT());
      this.determinedTotalShards = this.gatewayClientOptions.totalShards ?? response.body.shards;
      this.gatewayEndpoint = response.body.url;
      this.maxConcurrency = response.body.session_start_limit.max_concurrency;
      this.remaining = this.maxConcurrency;
    }
    if (shardIds) {
      for (let i = 0; i < shardIds.length; i += 1) {
        this.spawnShard(shardIds[i]);
      }
    } else {
      for (let i = 0; i < this.determinedTotalShards; i += 1) {
        this.spawnShard(i);
      }
    }
  }

  public getShardForGuild(guildId: string): GatewayShard | undefined {
    // eslint-disable-next-line no-bitwise
    return this.shards[Number(BigInt(guildId) >> 22n) % this.determinedTotalShards];
  }

  public requestMembersForGuild(guildId: string, options?: GatewayRequestGuildMembersData): void {
    const gatewayShard = this.getShardForGuild(guildId);
    if (!gatewayShard) {
      return;
    }
    let determinedOptions;
    if (options) {
      determinedOptions = {
        ...options,
        ...{
          guild_id: guildId,
        },
      };
    } else {
      determinedOptions = {
        guild_id: guildId,
        query: '',
        limit: 0,
      };
    }
    gatewayShard.send({
      op: GatewayOPCodes.RequestGuildMembers,
      d: determinedOptions,
    });
  }
}
