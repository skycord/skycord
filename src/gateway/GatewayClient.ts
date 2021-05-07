import EventEmitter from 'eventemitter3';
import { GatewayIdentifyDataPartial, GatewayShard } from './GatewayShard';

const { version } = require('../../package.json');

export type GatewayFeatureMode = 'LOCAL';

export type GatewayFeatureOptions = {
  mode: GatewayFeatureMode,
  websocketUrl: string,
  version: number,
  userAgent: string,
  shardConnectDelay: number,
  shardIds: number[],
  totalShards: number,
  intents: number,
};

const defaultGatewayFeatureOptions: GatewayFeatureOptions = {
  mode: 'LOCAL',
  websocketUrl: 'wss://gateway.discord.gg',
  version: 8,
  userAgent: `DiscordBot (Skycord, ${version})`,
  shardConnectDelay: 5000,
  shardIds: [0],
  totalShards: 1,
  intents: 513,
};

export class GatewayClient extends EventEmitter {
  public readonly gatewayFeatureOptions: GatewayFeatureOptions;

  private readonly token: string;

  public readonly shards: GatewayShard[] = [];

  constructor(token: string, gatewayFeatureOptions: Partial<GatewayFeatureOptions>) {
    super();
    this.token = token;
    this.gatewayFeatureOptions = {
      mode: gatewayFeatureOptions.mode ?? defaultGatewayFeatureOptions.mode,
      websocketUrl: gatewayFeatureOptions.websocketUrl ?? defaultGatewayFeatureOptions.websocketUrl,
      version: gatewayFeatureOptions.version ?? defaultGatewayFeatureOptions.version,
      userAgent: gatewayFeatureOptions.userAgent ?? defaultGatewayFeatureOptions.userAgent,
      shardConnectDelay: gatewayFeatureOptions.shardConnectDelay ?? defaultGatewayFeatureOptions.shardConnectDelay,
      shardIds: gatewayFeatureOptions.shardIds ?? defaultGatewayFeatureOptions.shardIds,
      totalShards: gatewayFeatureOptions.totalShards ?? defaultGatewayFeatureOptions.totalShards,
      intents: gatewayFeatureOptions.intents ?? defaultGatewayFeatureOptions.intents,
    };
  }

  public connect(identifyData?: GatewayIdentifyDataPartial) {
    if (this.gatewayFeatureOptions.shardIds.length > this.gatewayFeatureOptions.totalShards) {
      throw new Error('Shard id count is higher than the total shards.');
    }
    // Remove the shard property
    const localIdentifyData = {
      intents: this.gatewayFeatureOptions.intents,
      ...identifyData,
    };
    delete localIdentifyData.shard;
    // Spawn the shards
    this.createShards();
    const websocketUrl = `${this.gatewayFeatureOptions.websocketUrl}?v=${this.gatewayFeatureOptions.version}&encoding=etf`;
    this.connectShards(websocketUrl, {
      ...localIdentifyData,
    });
  }

  private createShards() {
    for (let i = 0; i < this.gatewayFeatureOptions.shardIds.length; i += 1) {
      const shard = new GatewayShard(this.token, this.gatewayFeatureOptions.shardIds[i], this.gatewayFeatureOptions.totalShards);
      shard.on('*', (event, ...args) => {
        this.emit('*', event, ...args);
        this.emit.call(this, event, ...args);
      });
      this.shards.push(shard);
    }
  }

  private async connectShards(url: string, identifyData?: GatewayIdentifyDataPartial) {
    // Note: eslint rule 'no-await-in-loop' is disabled so that we can connect one at a time to respect ratelimits
    for (let i = 0; i < this.shards.length; i += 1) {
      const shard = this.shards[i];
      // eslint-disable-next-line no-await-in-loop
      await shard.connect(url);
      shard.resumeOrIdentify(true, identifyData);
      // eslint-disable-next-line no-await-in-loop
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, this.gatewayFeatureOptions.shardConnectDelay);
      });
    }
  }
}
