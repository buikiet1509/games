import { describe, expect, it } from 'vitest';
import { Interpolator } from './interpolator';

describe('Interpolator', () => {
  it('nội suy tuyến tính giữa hai snapshot, trễ đúng delay', () => {
    const it = new Interpolator(100);
    it.push(0, 0, 0);
    it.push(100, 100, 50);
    expect(it.sample(150)).toEqual({ x: 50, y: 25 });
  });

  it('trước snapshot đầu → đứng ở vị trí đầu; sau snapshot cuối → giữ vị trí cuối', () => {
    const it = new Interpolator(100);
    it.push(1000, 10, 10);
    it.push(1100, 20, 20);
    expect(it.sample(1000)).toEqual({ x: 10, y: 10 });
    expect(it.sample(5000)).toEqual({ x: 20, y: 20 });
  });

  it('chọn đúng đoạn khi có nhiều snapshot', () => {
    const it = new Interpolator(0);
    it.push(0, 0, 0);
    it.push(100, 100, 0);
    it.push(200, 100, 100);
    expect(it.sample(150)).toEqual({ x: 100, y: 50 });
  });

  it('reset bỏ lịch sử cũ', () => {
    const it = new Interpolator(100);
    it.push(0, 0, 0);
    it.reset(500, 300, 300);
    expect(it.sample(550)).toEqual({ x: 300, y: 300 });
  });
});
