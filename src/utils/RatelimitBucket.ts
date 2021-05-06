import Timeout = NodeJS.Timeout;

export type GenericRatelimitBucketQueueFunction = (...args: unknown[]) => unknown;

export class RatelimitBucket {
  public max: number;

  public reset: number;

  public left: number;

  private lastRequestAt = 0;

  public locked: boolean = false;

  private queue: GenericRatelimitBucketQueueFunction[] = [];

  private timeout?: Timeout;

  constructor(max?: number, reset?: number, left?: number) {
    this.max = max ?? 1;
    this.reset = reset ?? 0;
    this.left = left ?? this.max;
  }

  public get ratelimited() {
    return this.left < 1 && Date.now() - this.lastRequestAt < this.reset;
  }

  add(genericRatelimitBucketQueueFunction: GenericRatelimitBucketQueueFunction) {
    if (this.ratelimited && !this.timeout) {
      this.timeout = setTimeout(() => {
        this.timeout = undefined;
        genericRatelimitBucketQueueFunction();
      }, this.reset);
      return;
    }
    this.queue.push(genericRatelimitBucketQueueFunction);
  }

  lock() {
    this.locked = true;
  }

  unlock(max?: number, reset?: number, left?: number, next?: boolean) {
    this.locked = false;
    this.lastRequestAt = Date.now();

    this.max = max ?? this.max;
    this.reset = reset ?? this.reset;
    this.left = left ?? this.left - 1;

    if (next ?? true) {
      const genericRatelimitBucketQueueFunction = this.queue.shift();
      if (genericRatelimitBucketQueueFunction) {
        genericRatelimitBucketQueueFunction();
      }
    }
  }
}
