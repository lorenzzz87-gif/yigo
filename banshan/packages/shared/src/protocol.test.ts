import { describe, expect, it } from 'vitest';
import { parseClientMessage, zhCN } from './index';

const anonId = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b';

describe('parseClientMessage', () => {
  it('accepts a valid hello', () => {
    const msg = parseClientMessage(JSON.stringify({ type: 'hello', anonId, name: zhCN.names[0] }));
    expect(msg).toEqual({ type: 'hello', anonId, name: zhCN.names[0] });
  });

  it('rejects names outside the pool', () => {
    expect(
      parseClientMessage(JSON.stringify({ type: 'hello', anonId, name: '随便写的' })),
    ).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'rename', name: 'hi' }))).toBeNull();
  });

  it('rejects any extra field, so a lamp can never carry text', () => {
    expect(parseClientMessage(JSON.stringify({ type: 'lamp' }))).toEqual({ type: 'lamp' });
    expect(parseClientMessage(JSON.stringify({ type: 'lamp', text: '一句话' }))).toBeNull();
  });

  it('validates seat range and actions', () => {
    expect(parseClientMessage(JSON.stringify({ type: 'sit', seat: 99 }))).not.toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'sit', seat: 100 }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'sit', seat: 1.5 }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'act', action: 'dance' }))).toBeNull();
  });

  it('returns null for malformed input instead of throwing', () => {
    for (const raw of ['', '{', 'null', '[]', '{"type":"nope"}', '{"type":"move","x":"1","z":2}']) {
      expect(parseClientMessage(raw)).toBeNull();
    }
    expect(parseClientMessage(new ArrayBuffer(4))).toBeNull();
  });
});

describe('copy', () => {
  it('keeps the quiet tone: no exclamation marks', () => {
    expect(JSON.stringify(zhCN)).not.toMatch(/[!！]/);
  });

  it('has unique names in the 「……的人」 format', () => {
    expect(new Set(zhCN.names).size).toBe(zhCN.names.length);
    for (const n of zhCN.names) expect(n).toMatch(/的人$/);
  });
});

describe('rooms and time zones', () => {
  it('buckets the UTC offset to whole hours', async () => {
    const { tzBucket } = await import('./index');
    expect(tzBucket(-60)).toBe(1); // 意大利冬令时
    expect(tzBucket(-120)).toBe(2);
    expect(tzBucket(300)).toBe(-5);
    expect(tzBucket(-330)).toBe(6); // 印度 +5:30 → +6
    expect(tzBucket(0)).toBe(0);
    expect(tzBucket(-9999)).toBe(14);
    expect(tzBucket(9999)).toBe(-12);
  });

  it('round-trips room ids and rejects bad ones', async () => {
    const { makeRoomId, parseRoomId } = await import('./index');
    expect(parseRoomId(makeRoomId(-5, 12))).toEqual({ bucket: -5, index: 12 });
    expect(parseRoomId(makeRoomId(8, 0))).toEqual({ bucket: 8, index: 0 });
    for (const bad of [
      '',
      'tz99.1',
      'tz-13.0',
      'tz1',
      'tz1.x',
      '../tz1.0',
      'tz1.0/x',
      'tz1.1234567',
    ]) {
      expect(parseRoomId(bad), bad).toBeNull();
    }
  });

  it('has a name pool of at least 100', () => {
    expect(zhCN.names.length).toBeGreaterThanOrEqual(100);
  });

  it('drops oversized client messages', () => {
    const big = JSON.stringify({ type: 'stand', pad: 'x'.repeat(1000) });
    expect(parseClientMessage(big)).toBeNull();
  });
});
