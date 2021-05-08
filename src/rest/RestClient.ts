import fetch, { BodyInit, Headers } from 'node-fetch';
import { File, FormData } from 'formdata-node';
import { URLSearchParams } from 'url';
import AbortController from 'abort-controller';
import { RatelimitBucket } from '../utils/RatelimitBucket';
import { RestError } from './RestError';

const { version } = require('../../package.json');

export type RestFeatureMode = 'LOCAL';

export type RestFeatureOptions = {
  mode: RestFeatureMode,
  baseUrl: string,
  version: number,
  userAgent: string,
  delay: number,
};

const defaultRestFeatureOptions: RestFeatureOptions = {
  mode: 'LOCAL',
  baseUrl: 'https://discord.com/api',
  version: 8,
  userAgent: `DiscordBot (Skycord, ${version})`,
  delay: 15000,
};

export interface RequestOptions {
  data?: unknown;
  files?: File[];
  method?: string;
  query?: Record<string, string>;
  reason?: string;
  bufferOutput?: boolean;
}

export const parseRateLimitRoute = (route: string, method?: string) => {
  const parsedRoute = route.replace(/\/(\w+)\/\d+/g, '/$1/:id');
  if (parsedRoute.includes('/reactions/')) {
    return parsedRoute.replace(/\/reactions\/[^/]+/, '/reactions/:emoji');
  }
  if (method === 'DELETE' && parsedRoute.endsWith('messages/:id')) {
    return `DELETE ${parsedRoute}`;
  }
  return parsedRoute;
};

export class RestClient extends Map<string, RatelimitBucket> {
  public readonly restFeatureOptions: RestFeatureOptions;

  private readonly token: string;

  constructor(token: string, restFeatureOptions: Partial<RestFeatureOptions>) {
    super();
    this.token = token;
    this.restFeatureOptions = {
      mode: restFeatureOptions.mode ?? defaultRestFeatureOptions.mode,
      baseUrl: restFeatureOptions.baseUrl ?? defaultRestFeatureOptions.baseUrl,
      version: restFeatureOptions.version ?? defaultRestFeatureOptions.version,
      userAgent: restFeatureOptions.userAgent ?? defaultRestFeatureOptions.userAgent,
      delay: restFeatureOptions.delay ?? defaultRestFeatureOptions.delay,
    };
  }

  async request<T = unknown>(path: string, options?: RequestOptions): Promise<T> {
    const pathAdjusted = path.startsWith('/') ? path.substring(1) : path;
    const route = parseRateLimitRoute(pathAdjusted);
    const bucket = this.get(route) ?? new RatelimitBucket();
    this.set(route, bucket);

    if (bucket.locked || bucket.ratelimited) {
      return new Promise<T>((resolve, reject) => {
        bucket.add(() => this.request<T>(pathAdjusted, options).then(resolve, reject));
      });
    }

    const headers = new Headers();
    headers.set('authorization', `Bot ${this.token}`);
    headers.set('user-agent', this.restFeatureOptions.userAgent);
    if (options?.reason) {
      headers.set('x-audit-log-reason', options.reason);
    }

    let body;
    if (options?.files) {
      body = new FormData();
      for (let i = 0; i < options.files.length; i += 1) {
        body.append(options.files[i].name, options.files[i]);
      }
      if (options.data) {
        body.append('payload_json', JSON.stringify(options.data));
      }
    } else if (options?.data) {
      body = JSON.stringify(options.data);
      headers.set('content-type', 'application/json');
    }

    let url = `${this.restFeatureOptions.baseUrl}/v${this.restFeatureOptions.version}/${pathAdjusted}`;
    if (options?.query) {
      url += `?${new URLSearchParams(options.query)}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.restFeatureOptions.delay);

    bucket.lock();
    const response = await fetch(url, {
      body: (body as BodyInit | undefined),
      headers,
      method: options?.method,
      signal: controller.signal,
    });

    const resetAfter = parseFloat(response.headers.get('x-ratelimit-reset-after') ?? '0') * 1000;

    if (response.status === 429) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, resetAfter);
      });
      return this.request<T>(pathAdjusted, options);
    }

    bucket.unlock(
      parseInt(response.headers.get('x-ratelimit-limit') ?? '0', 10),
      resetAfter,
      parseInt(response.headers.get('x-ratelimit-remaining') ?? '0', 10),
    );

    clearTimeout(timeout);

    let result;
    if (options && options.bufferOutput === true) {
      result = await response.buffer();
    } else {
      result = response.headers.get('content-type') === 'application/json' ? await response.json() : await response.text();
    }
    if (response.ok) {
      return result as T;
    }
    if (Buffer.isBuffer(result)) {
      throw new RestError(JSON.parse(result.toString()));
    }
    if (typeof result === 'string' || result instanceof String) {
      throw new RestError(JSON.parse(String(result)));
    }
    throw new RestError(result);
  }
}
