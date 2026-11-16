import { RATE_LIMIT_KICK_AFTER_MS, RATE_LIMIT_PER_SEC } from '@banshan/shared';

export type RateVerdict = 'ok' | 'drop' | 'kick';

/**
 * 每个连接的限流（§4.5）：每秒最多 10 条，超出的丢弃；连续超限 10 秒就断开。
 * 时间由调用方传入，方便测试。
 */
export class RateLimiter {
  private windowStart = 0;
  private count = 0;
  /** 连续超限是从什么时候开始的；没有超限时为 null */
  private overSince: number | null = null;

  check(now: number): RateVerdict {
    if (now - this.windowStart >= 1000) {
      // 上一个窗口没超限，或者中间安静过整整一秒：连续超限中断
      const wasOver = this.count > RATE_LIMIT_PER_SEC;
      const gap = now - this.windowStart >= 2000;
      if (!wasOver || gap) this.overSince = null;
      this.windowStart = now;
      this.count = 0;
    }
    this.count++;
    if (this.count <= RATE_LIMIT_PER_SEC) return 'ok';
    this.overSince ??= now;
    return now - this.overSince >= RATE_LIMIT_KICK_AFTER_MS ? 'kick' : 'drop';
  }
}
