import type { ClientType } from '../client/Client';

const { version } = require('../../package.json');

export interface RestClientOptions {

  version: number;

  baseUrl: string;

  userAgent: string;

  token: string | undefined;
}

export const defaultRestClientOptions: RestClientOptions = {
  version: 9,
  baseUrl: 'https://discord.com/api',
  userAgent: `DiscordBot (Skycord, ${version})`,
  token: undefined,
};

export interface RestRequestFile {

  name: string;

  value: any;
}

export interface RestRequestOptions {
  data?: unknown;
  files?: RestRequestFile[];
  method?: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  reason?: string;
  authenticate?: boolean;
}

export interface RestResponse<T> {
  status: number;
  body: T;
  headers: Record<string, string>;
}

export abstract class RestClient<O = RestClientOptions> {
  public readonly mode: string;

  public readonly client: ClientType;

  public readonly restClientOptions: O;

  constructor(mode: string, client: ClientType, restClientOptions: O) {
    this.mode = mode;
    this.client = client;
    this.restClientOptions = restClientOptions;
  }

  abstract request<T = unknown>(path: string, options?: RestRequestOptions): Promise<RestResponse<T>>;
}
