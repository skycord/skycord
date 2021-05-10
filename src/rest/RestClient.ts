import { File } from 'formdata-node';
import type { Client } from '../client/Client';

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

export interface RestRequestOptions {
  data?: unknown;
  files?: File[];
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

  public readonly client: Client<RestClient>;

  public readonly restClientOptions: O;

  constructor(mode: string, client: Client<RestClient>, restClientOptions: O) {
    this.mode = mode;
    this.client = client;
    this.restClientOptions = restClientOptions;
  }

  abstract request<T = unknown>(path: string, options?: RestRequestOptions): Promise<RestResponse<T>>;
}
