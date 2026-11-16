import { zhCN } from '@banshan/shared';

/**
 * 匿名身份（§4.4）：首次访问时在本地生成一个 UUID，只用于重连、每天一盏灯和去重统计。
 * 存不了（隐私模式等）就只在这次访问里记着。
 */
const memory = new Map<string, string>();

function read(key: string): string | null {
  try {
    return localStorage.getItem(key) ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}

function write(key: string, value: string): void {
  memory.set(key, value);
  try {
    localStorage.setItem(key, value);
  } catch {
    // 存不了就算了
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NAMES: readonly string[] = zhCN.names;

export function getAnonId(): string {
  const saved = read('banshan.anonId');
  if (saved && UUID.test(saved)) return saved;
  const id = crypto.randomUUID();
  write('banshan.anonId', id);
  return id;
}

export function randomName(except?: string): string {
  const pool = NAMES.filter((n) => n !== except);
  return pool[Math.floor(Math.random() * pool.length)]!;
}

export function getName(): string {
  const saved = read('banshan.name');
  if (saved && NAMES.includes(saved)) return saved;
  const name = randomName();
  write('banshan.name', name);
  return name;
}

export function saveName(name: string): void {
  write('banshan.name', name);
}
