import { wait } from './TimerUtils';
import { RatelimitBucket } from './RatelimitBucket';

type QueuedRatelimitBucketQueueFunction<T = unknown> = (...args: unknown[]) => Promise<T>;

export interface RatelimitBucketRestClient {

  ratelimited: Promise<void> | undefined;
}

export class QueuedRatelimitBucket extends RatelimitBucket {
  private functionQueue: Promise<unknown>;

  private ratelimitBucketRestClient: RatelimitBucketRestClient;

  constructor(ratelimitBucketRestClient: RatelimitBucketRestClient) {
    super();
    this.functionQueue = Promise.resolve();
    this.ratelimitBucketRestClient = ratelimitBucketRestClient;
  }

  async queue<T>(queuedRatelimitBucketQueueFunction: QueuedRatelimitBucketQueueFunction<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.functionQueue = this.functionQueue.then(async () => {
        if (this.ratelimitBucketRestClient.ratelimited) {
          await this.ratelimitBucketRestClient.ratelimited;
        }
        if (this.ratelimited) {
          await wait(this.resetAfter);
        }
        await queuedRatelimitBucketQueueFunction().then(resolve, reject);
      });
    });
  }
}
