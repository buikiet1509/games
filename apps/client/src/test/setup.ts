import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/preact';

// Node ≥ 22 có sẵn `localStorage` riêng (cần --localstorage-file, không thì undefined), che mất
// localStorage của jsdom → gắn lại bản của jsdom cho môi trường test.
const dom = (globalThis as { jsdom?: { window: Window } }).jsdom;
if (dom && !globalThis.localStorage) {
  for (const key of ['localStorage', 'sessionStorage'] as const) {
    Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
  }
}

afterEach(cleanup);
