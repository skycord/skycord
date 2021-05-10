import EventEmitter from 'eventemitter3';
import { defaultRestClientOptions, RestClient, RestClientOptions } from '../rest/RestClient';
import { defaultGatewayClientOptions, GatewayClient, GatewayClientOptions } from '../gateway/GatewayClient';

export interface ClientOptions {

  token: string;
}

export class Client<R extends RestClient> extends EventEmitter {
  public readonly clientOptions: ClientOptions;

  private restClient: R | undefined;

  public get rest(): R {
    if (!this.restClient) {
      throw new Error('The rest client must be initialized before it can be used.');
    }
    return this.restClient;
  }

  private gatewayClient: GatewayClient | undefined;

  public get gateway(): GatewayClient {
    if (!this.gatewayClient) {
      throw new Error('The gateway client must be initialized before it can be used.');
    }
    return this.gatewayClient;
  }

  constructor(clientOptions: ClientOptions) {
    super();
    this.clientOptions = clientOptions;
  }

  public initializeNewRestClient<O extends RestClientOptions>(RestClientType: {
    new (client: Client<RestClient>, restClientOptions: RestClientOptions): R;
  }, restClientOptions?: Partial<O>): R {
    this.restClient = new RestClientType(this, {
      ...defaultRestClientOptions,
      ...{
        token: this.clientOptions.token,
      },
      ...restClientOptions,
    });
    return this.restClient;
  }

  public initializeNewGatewayClient(gatewayClientOptions?: Partial<GatewayClientOptions>): GatewayClient {
    if (!this.restClient) {
      throw new Error('The rest client must be initialized before the gateway client.');
    }
    this.gatewayClient = new GatewayClient(this, {
      ...defaultGatewayClientOptions,
      ...{
        token: this.clientOptions.token,
      },
      ...gatewayClientOptions,
    });
    return this.gatewayClient;
  }
}
