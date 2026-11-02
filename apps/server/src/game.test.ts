import type { IncomingMessage } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { LocalPresence } from '@colyseus/core';
import { flyRouting } from './game';

const req = (url: string) => ({ req: { url } as IncomingMessage });

describe('định tuyến WebSocket giữa các máy Fly.io', () => {
  it('room của máy này → cho qua; room của máy khác → trả fly-replay về đúng máy', async () => {
    const presence = new LocalPresence();
    const a = flyRouting(presence, 'machine-a', () => 'proc-a');
    await a.register();
    await presence.hset('fly:machines', 'proc-b', 'machine-b');

    const own = vi.fn();
    a.verifyClient(req('/proc-a/room1?sessionId=x'), own);
    expect(own).toHaveBeenCalledWith(true);

    const foreign = await new Promise<unknown[]>((resolve) =>
      a.verifyClient(req('/proc-b/room2?sessionId=y'), (...args) => resolve(args)),
    );
    expect(foreign).toEqual([
      false,
      409,
      'Chuyển tới máy giữ room',
      { 'fly-replay': 'instance=machine-b' },
    ]);
  });

  it('processId lạ (không có trong bảng) → để Colyseus tự từ chối, không chuyển tiếp vòng vèo', async () => {
    const presence = new LocalPresence();
    const a = flyRouting(presence, 'machine-a', () => 'proc-a');
    const result = await new Promise<unknown[]>((resolve) =>
      a.verifyClient(req('/khong-co/room?x=1'), (...args) => resolve(args)),
    );
    expect(result).toEqual([true]);
  });

  it('tắt máy thì gỡ khỏi bảng định tuyến', async () => {
    const presence = new LocalPresence();
    const a = flyRouting(presence, 'machine-a', () => 'proc-a');
    await a.register();
    expect(await presence.hget('fly:machines', 'proc-a')).toBe('machine-a');
    await a.unregister();
    expect(await presence.hget('fly:machines', 'proc-a')).toBeFalsy();
  });
});
