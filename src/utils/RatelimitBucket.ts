export class RatelimitBucket {
  public reset: number = Infinity;

  public remaining: number = 1;

  public limit: number = -1;

  public resetAfter: number = -1;

  get ratelimited(): boolean {
    return this.remaining < 1 && Date.now() < this.reset;
  }

  update(responseHeaders: Record<string, string>): void {
    const dateHeader = responseHeaders.date;
    const ratelimitLimitHeader = responseHeaders['x-ratelimit-limit'];
    const ratelimitRemainingHeader = responseHeaders['x-ratelimit-remaining'];
    const ratelimitResetHeader = responseHeaders['x-ratelimit-reset'];
    const ratelimitResetAfterHeader = responseHeaders['x-ratelimit-reset-after'];

    this.limit = ratelimitLimitHeader ? Number(ratelimitLimitHeader) : Infinity;
    this.remaining = ratelimitRemainingHeader ? Number(ratelimitRemainingHeader) : 1;

    this.reset = ratelimitResetHeader ? new Date(Number(ratelimitResetHeader) * 1000).getTime() - (new Date(dateHeader).getTime() - Date.now()) : Date.now();
    this.resetAfter = ratelimitResetAfterHeader ? Number(ratelimitResetAfterHeader) * 1000 : -1;
  }
}
