import { RestClient, RestFeatureOptions } from './rest/RestClient';
import { GatewayClient, GatewayFeatureOptions } from './gateway/GatewayClient';

export type ClientOptions = {
  features?: {
    rest?: Partial<RestFeatureOptions>,
    gateway?: Partial<GatewayFeatureOptions>,
  },
};

export class Client {
  public readonly clientOptions: ClientOptions;

  private restClient: RestClient | undefined;

  private gatewayClient: GatewayClient | undefined;

  public get rest(): RestClient {
    if (!this.restClient) {
      throw new Error('The RestClient was not initialized yet, try using the setup method first.');
    }
    return this.restClient;
  }

  public get gateway(): GatewayClient {
    if (!this.gatewayClient) {
      throw new Error('The GatewayClient was not initialized yet, try using the setup method first.');
    }
    return this.gatewayClient;
  }

  constructor(clientOptions?: ClientOptions) {
    this.clientOptions = clientOptions ?? {};
  }

  setup(token: string): void {
    let restFeatureOptions = {};
    if (this.clientOptions.features && this.clientOptions.features.rest) {
      restFeatureOptions = this.clientOptions.features.rest;
    }
    this.restClient = new RestClient(token, restFeatureOptions);
    let gatewayFeatureOptions = {};
    if (this.clientOptions.features && this.clientOptions.features.gateway) {
      gatewayFeatureOptions = this.clientOptions.features.gateway;
    }
    this.gatewayClient = new GatewayClient(token, gatewayFeatureOptions);
  }
}
