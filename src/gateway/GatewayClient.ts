import EventEmitter from 'eventemitter3';
import type { Client } from '../client/Client';
import type { RestClient } from '../rest/RestClient';
import { wait } from '../utils/TimerUtils';
import { GatewayShard } from './GatewayShard';

export interface GatewayClientOptions {

  version: number;

  intents: number;

  token: string | undefined;

  totalShards: number | undefined;
}

export const defaultGatewayClientOptions: GatewayClientOptions = {
  version: 9,
  intents: 513,
  token: undefined,
  totalShards: undefined,
};

export class GatewayClient extends EventEmitter {
  public readonly client: Client<RestClient>;

  public readonly gatewayClientOptions: GatewayClientOptions;

  public gatewayEndpoint: string | undefined;

  public maxConcurrency: number;

  public shards: GatewayShard[];

  private shardSpawnQueue: Promise<void>;

  private remaining: number;

  public determinedTotalShards = 1;

  constructor(client: Client<RestClient>, gatewayClientOptions: GatewayClientOptions) {
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
      }>('/gateway/bot');
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
}
