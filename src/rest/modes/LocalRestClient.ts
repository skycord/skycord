import { URLSearchParams } from 'url';
import fetch, { BodyInit, Headers } from 'node-fetch';
import FormData from 'form-data';
import { RatelimitBucketRestClient, QueuedRatelimitBucket } from '../../utils/QueuedRatelimitBucket';
import {
  defaultRestClientOptions, RestClient, RestClientOptions, RestRequestOptions, RestResponse,
} from '../RestClient';
import { RestError, RestErrorBody } from '../RestError';
import type { ClientType } from '../../client/Client';

export interface LocalRestClientOptions extends RestClientOptions {}

export class LocalRestClient extends RestClient<LocalRestClientOptions> implements RatelimitBucketRestClient {
  public ratelimited: Promise<void> | undefined;

  private buckets: Map<string | null, QueuedRatelimitBucket>;

  private routes: Map<string, QueuedRatelimitBucket>;

  constructor(client: ClientType, restClientOptions: LocalRestClientOptions) {
    super('LOCAL', client, {
      ...defaultRestClientOptions,
      ...restClientOptions,
    });
    this.buckets = new Map<string, QueuedRatelimitBucket>();
    this.routes = new Map<string, QueuedRatelimitBucket>();
  }

  private async sendRequest<T = unknown>(route: string, path: string, options?: RestRequestOptions): Promise<RestResponse<T>> {
    const headers = new Headers();
    if (options?.authenticate !== false) {
      headers.set('authorization', `Bot ${this.restClientOptions.token}`);
    }
    headers.set('user-agent', this.restClientOptions.userAgent);
    if (options?.reason) {
      headers.set('x-audit-log-reason', options.reason);
    }
    if (options?.headers) {
      Object.keys(options.headers).forEach((key: string) => {
        headers.set(key, options.headers![key]);
      });
    }

    let body;
    if (options?.files && options.files.length > 0) {
      body = new FormData();
      for (let i = 0; i < options.files.length; i += 1) {
        body.append(options.files[i].name, typeof options.files[i].value === 'string' ? Buffer.from(options.files[i].value) : options.files[i].value, {
          filename: options.files[i].name,
        });
      }
      if (options.data) {
        body.append('payload_json', JSON.stringify(options.data));
      }
      headers.set('content-type', body.getHeaders()['content-type']);
    } else if (options?.data) {
      body = JSON.stringify(options.data);
      headers.set('content-type', 'application/json');
    }

    let url = `${this.restClientOptions.baseUrl}/v${this.restClientOptions.version}${path}`;
    if (options?.query) {
      url += `?${new URLSearchParams(options.query)}`;
    }

    const response = await fetch(url, {
      body: (body as BodyInit | undefined),
      headers,
      method: options?.method ? options.method.toLowerCase() : 'get',
    });

    const responseHeaders: Record<string, string> = {};

    response.headers.forEach((value: string | string[], key: string) => {
      responseHeaders[key] = Array.isArray(value) ? value[0] : value;
    });

    if (response.status === 429) {
      this.client.emit('rest:ratelimited', {
        bucket: responseHeaders['x-ratelimit-bucket'],
        global: responseHeaders['x-ratelimit-global'],
        limit: responseHeaders['x-ratelimit-limit'],
        remaining: responseHeaders['x-ratelimit-remaining'],
        reset: responseHeaders['x-ratelimit-reset'],
        resetAfter: responseHeaders['x-ratelimit-reset-after'],
      });
    }

    const responseBody = response.headers.get('content-type') === 'application/json' ? await response.json() : await response.buffer();

    if (response.headers.has('x-ratelimit-global')) {
      this.ratelimited = new Promise<void>((resolve) => {
        setTimeout(() => {
          this.ratelimited = undefined;
          resolve();
        }, Number(responseBody.retry_after) * 1000);
      });
    }

    const bucketHash = response.headers.get('x-ratelimit-bucket');

    if (!this.buckets.has(bucketHash)) {
      this.buckets.set(bucketHash, this.routes.get(route)!);
    }
    this.routes.set(route, this.buckets.get(bucketHash)!);
    const bucket = this.routes.get(route)!;

    bucket.update(responseHeaders);

    const restResponse: RestResponse<T> = {
      status: response.status,
      body: responseBody as T,
      headers: responseHeaders,
    };

    if (!response.ok && response.status !== 429) {
      throw new RestError(restResponse as unknown as RestResponse<RestErrorBody>);
    }
    return restResponse;
  }

  async request<T = unknown>(path: string, options?: RestRequestOptions): Promise<RestResponse<T>> {
    const method = options?.method ? options.method.toLowerCase() : 'get';
    let route = `${method}:${path.replace(/\/(\w+)\/\d+/g, '/$1/:id')}`;
    if (route.includes('/reactions/')) {
      route = route.replace(/\/reactions\/[^/]+/, '/reactions/:emoji');
    }

    if (!this.routes.has(route)) {
      this.routes.set(route, new QueuedRatelimitBucket(this));
    }

    const restResponse = await this.routes.get(route)!.queue<RestResponse<T>>(async () => this.sendRequest<T>(route, path, options));
    if (restResponse.status === 429) {
      return this.request<T>(path, options);
    }
    return restResponse;
  }
}
