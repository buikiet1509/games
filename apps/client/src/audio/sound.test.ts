import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** AudioContext giả mô phỏng Safari: tạo ra ở trạng thái "suspended", phải resume() mới chạy. */
class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state: 'suspended' | 'running' = 'suspended';
  currentTime = 0;
  destination = {};
  oscillators = 0;
  onstatechange: (() => void) | null = null;
  resume = vi.fn(async () => {
    this.state = 'running';
    this.onstatechange?.();
  });
  constructor() {
    FakeAudioContext.instances.push(this);
  }
  private param() {
    return {
      value: 0,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      setTargetAtTime: vi.fn(),
    };
  }
  private node() {
    return { connect: (n: unknown) => n };
  }
  createGain() {
    return { ...this.node(), gain: this.param() };
  }
  createOscillator() {
    this.oscillators++;
    return { ...this.node(), type: 'sine', frequency: this.param(), start: vi.fn(), stop: vi.fn() };
  }
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const totalOscillators = () => FakeAudioContext.instances.reduce((n, c) => n + c.oscillators, 0);
let uninstall: (() => void) | undefined;

describe('âm thanh', () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
    FakeAudioContext.instances = [];
  });
  afterEach(() => {
    uninstall?.(); // không để bộ lắng nghe của test này lọt sang test sau
    uninstall = undefined;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('nhớ lựa chọn tắt tiếng giữa các lần mở trang', async () => {
    const a = await import('./sound');
    expect(a.muted.value).toBe(false);
    a.setMuted(true);
    vi.resetModules();
    const b = await import('./sound');
    expect(b.muted.value).toBe(true);
  });

  it('không lỗi khi trình duyệt không có Web Audio', async () => {
    const s = await import('./sound');
    expect(() => {
      uninstall = s.installAudioUnlock();
      s.unlockAudio();
      s.playBell();
      s.setAmbience('san-chua');
      s.setAmbience(null);
    }).not.toThrow();
  });

  it('chưa có thao tác thì không phát; click (như nút "Vào chùa") thì mở khoá và resume', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const s = await import('./sound');
    uninstall = s.installAudioUnlock();
    s.playBell();
    expect(FakeAudioContext.instances).toHaveLength(0);

    document.body.click();
    await flush();
    const ctx = FakeAudioContext.instances[0]!;
    expect(ctx.resume).toHaveBeenCalled();
    expect(s.audioReady.value).toBe(true);

    s.playBell();
    expect(totalOscillators()).toBeGreaterThan(0);
  });

  it('Safari: pointerdown không đủ, nhưng touchend/keydown thì được', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const s = await import('./sound');
    uninstall = s.installAudioUnlock();
    window.dispatchEvent(new Event('pointerdown'));
    expect(FakeAudioContext.instances).toHaveLength(0);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flush();
    expect(s.audioReady.value).toBe(true);
  });

  it('khi AudioContext còn "suspended" thì không xếp âm (tránh dồn phát một lúc)', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const s = await import('./sound');
    s.unlockAudio();
    const ctx = FakeAudioContext.instances[0]!;
    ctx.resume.mockImplementation(async () => {}); // trình duyệt từ chối resume
    ctx.state = 'suspended';
    s.playBell();
    expect(ctx.oscillators).toBe(0);
  });

  it('bấm nút bật tiếng cũng mở khoá và cho nghe thử ngay', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const s = await import('./sound');
    s.setMuted(true);
    s.setMuted(false);
    await flush();
    expect(s.audioReady.value).toBe(true);
  });

  it('vẫn chạy khi localStorage bị chặn', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const s = await import('./sound');
    expect(s.muted.value).toBe(false);
    expect(() => s.setMuted(true)).not.toThrow();
    expect(s.muted.value).toBe(true);
  });
});
