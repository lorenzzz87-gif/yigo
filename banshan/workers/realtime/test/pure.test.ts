import { describe, expect, it } from 'vitest';
import { chooseRoom } from '../src/matching';
import { RateLimiter } from '../src/rateLimit';

describe('chooseRoom (§4.3)', () => {
  it('returns null when there are no rooms or all are full', () => {
    expect(chooseRoom([])).toBeNull();
    expect(chooseRoom([{ id: 'a', count: 100 }])).toBeNull();
  });

  it('prefers a room with 30–90 people', () => {
    const rooms = [
      { id: 'quiet', count: 10 },
      { id: 'good', count: 45 },
      { id: 'crowded', count: 96 },
    ];
    expect(chooseRoom(rooms)).toBe('good');
    expect(
      chooseRoom([
        { id: 'a', count: 30 },
        { id: 'b', count: 90 },
      ]),
    ).toBe('b');
  });

  it('otherwise picks the fullest room that still has space', () => {
    expect(
      chooseRoom([
        { id: 'quiet', count: 10 },
        { id: 'crowded', count: 96 },
        { id: 'full', count: 100 },
      ]),
    ).toBe('crowded');
    expect(
      chooseRoom([
        { id: 'a', count: 3 },
        { id: 'b', count: 12 },
      ]),
    ).toBe('b');
  });
});

describe('RateLimiter (§4.5)', () => {
  it('allows 10 messages a second and drops the rest', () => {
    const rl = new RateLimiter();
    const verdicts = Array.from({ length: 15 }, (_, i) => rl.check(1000 + i));
    expect(verdicts.slice(0, 10).every((v) => v === 'ok')).toBe(true);
    expect(verdicts.slice(10).every((v) => v === 'drop')).toBe(true);
    expect(rl.check(2000)).toBe('ok');
  });

  it('kicks after 10 seconds of continuous flooding', () => {
    const rl = new RateLimiter();
    let verdict = 'ok';
    let t = 0;
    for (; t < 9_900; t += 20) verdict = rl.check(t);
    expect(verdict).toBe('drop');
    for (; t < 10_500 && verdict !== 'kick'; t += 20) verdict = rl.check(t);
    expect(verdict).toBe('kick');
  });

  it('forgives a burst once the sender calms down', () => {
    const rl = new RateLimiter();
    let t = 0;
    for (; t < 8_000; t += 20) rl.check(t);
    // 安静两秒，再重新超频：计时重新开始，不会马上被断开
    t += 2_500;
    let verdict = 'ok';
    for (const end = t + 5_000; t < end; t += 20) verdict = rl.check(t);
    expect(verdict).toBe('drop');
  });
});
