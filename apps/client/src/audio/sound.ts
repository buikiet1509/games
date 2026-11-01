import { signal } from '@preact/signals';
import type { AreaId } from '@chua/shared';

// Âm thanh tổng hợp bằng Web Audio (không cần file): chuông chùa, chuông gió, mõ.
// Trình duyệt chỉ cho phát sau thao tác của người dùng: Safari chỉ tính click/touchend/keydown
// (không tính pointerdown) và AudioContext tạo ra có thể vẫn "suspended" → phải resume() trong
// chính thao tác đó. Xem installAudioUnlock().

const MUTE_KEY = 'chua:muted';

function loadMuted() {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export const muted = signal(loadMuted());
/** Âm thanh đã thật sự chạy được (AudioContext ở trạng thái "running"). */
export const audioReady = signal(false);

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let ambienceTimer: ReturnType<typeof setTimeout> | undefined;
let ambienceArea: AreaId | null = null;

const MASTER_VOLUME = 0.6;

type AudioCtor = typeof AudioContext;
const getAudioCtor = (): AudioCtor | undefined =>
  typeof window === 'undefined'
    ? undefined
    : (window.AudioContext ??
      (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext);

/** Gọi trong một thao tác của người dùng: tạo (nếu chưa có) và đánh thức AudioContext. */
export function unlockAudio() {
  const Ctor = getAudioCtor();
  if (!Ctor) return;
  if (!ctx) {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted.value ? 0 : MASTER_VOLUME;
    master.connect(ctx.destination);
    const c = ctx;
    c.onstatechange = () => {
      const running = c.state === 'running';
      if (running && !audioReady.value && ambienceArea && ambienceArea !== 'chinh-dien') {
        playChimes(); // vừa mở được âm thanh → cho nghe ngay, không đợi lượt chuông gió kế tiếp
      }
      audioReady.value = running;
    };
  }
  if (ctx.state !== 'running') void ctx.resume().catch(() => {});
  audioReady.value = ctx.state === 'running';
}

const UNLOCK_EVENTS = ['click', 'touchend', 'keydown', 'pointerup'] as const;

/**
 * Gắn một lần khi mở trang (trước cả màn đăng nhập), để cú bấm "Vào chùa" đã mở khoá âm thanh.
 * Giữ lắng nghe tới khi âm thanh thật sự chạy (có trình duyệt cần vài thao tác).
 */
export function installAudioUnlock() {
  const remove = () => {
    for (const e of UNLOCK_EVENTS) window.removeEventListener(e, handler, true);
  };
  const handler = () => {
    unlockAudio();
    if (ctx?.state === 'running') remove();
  };
  for (const e of UNLOCK_EVENTS)
    window.addEventListener(e, handler, { capture: true, passive: true });
  return remove;
}

export function setMuted(value: boolean) {
  muted.value = value;
  try {
    window.localStorage.setItem(MUTE_KEY, value ? '1' : '0');
  } catch {
    // bộ nhớ trình duyệt bị chặn → chỉ nhớ trong phiên này
  }
  if (ctx && master) master.gain.setTargetAtTime(value ? 0 : MASTER_VOLUME, ctx.currentTime, 0.05);
  if (!value) {
    unlockAudio(); // bấm nút bật tiếng cũng là một thao tác hợp lệ để mở khoá
    playChimes(); // cho nghe thử ngay
  }
}

// Chỉ phát khi AudioContext đang chạy: lúc "suspended" thời gian bị đứng, âm sẽ dồn lại phát một lúc.
const ready = () =>
  ctx && master && !muted.value && ctx.state === 'running' ? { ctx, master } : null;

/** Một âm sine tắt dần theo hàm mũ. */
function tone(freq: number, gain: number, decaySec: number, at = 0, type: OscillatorType = 'sine') {
  const a = ready();
  if (!a) return;
  const t = a.ctx.currentTime + at;
  const osc = a.ctx.createOscillator();
  const g = a.ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decaySec);
  osc.connect(g).connect(a.master);
  osc.start(t);
  osc.stop(t + decaySec + 0.05);
}

/** Chuông chùa: các bội âm không điều hoà, ngân dài (~8 giây). */
export function playBell() {
  const base = 128;
  const partials: [number, number, number][] = [
    [0.5, 0.35, 9], // hum
    [1, 0.5, 8],
    [1.006, 0.3, 8], // lệch nhẹ tạo tiếng "ngân" rung
    [2.0, 0.28, 5.5],
    [2.76, 0.22, 4],
    [4.07, 0.12, 2.6],
    [5.4, 0.08, 1.8],
  ];
  for (const [ratio, gain, decay] of partials) tone(base * ratio, gain * 0.5, decay);
}

/** Một tiếng mõ gỗ ngắn. */
export function playWoodBlock(volume = 0.25) {
  const a = ready();
  if (!a) return;
  const t = a.ctx.currentTime;
  const osc = a.ctx.createOscillator();
  const g = a.ctx.createGain();
  osc.frequency.setValueAtTime(720, t);
  osc.frequency.exponentialRampToValueAtTime(430, t + 0.07);
  g.gain.setValueAtTime(volume, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  osc.connect(g).connect(a.master);
  osc.start(t);
  osc.stop(t + 0.25);
}

/** Vài tiếng chuông gió cao, nhẹ (thang ngũ cung). */
function playChimes() {
  const notes = [1047, 1175, 1397, 1568, 1760, 2093, 2349];
  const count = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const f = notes[Math.floor(Math.random() * notes.length)]!;
    const at = i * (0.15 + Math.random() * 0.25);
    tone(f, 0.09, 2.6, at);
    tone(f * 2.4, 0.025, 1.2, at);
  }
}

/** Âm thanh nền theo khu: mõ chậm trong Chính điện, chuông gió ở các khu ngoài trời. */
export function setAmbience(area: AreaId | null) {
  ambienceArea = area;
  clearTimeout(ambienceTimer);
  if (area) scheduleAmbience();
}

function scheduleAmbience() {
  clearTimeout(ambienceTimer);
  const area = ambienceArea;
  if (!area) return;
  if (area === 'chinh-dien') {
    playWoodBlock(0.12);
    ambienceTimer = setTimeout(scheduleAmbience, 1500);
  } else {
    playChimes();
    ambienceTimer = setTimeout(scheduleAmbience, 5000 + Math.random() * 6000);
  }
}
