// Icon nét dùng trong màn chơi.
import type { JSX } from 'preact';

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 1.75,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
  'aria-hidden': true,
  focusable: 'false',
} as const;

type P = JSX.SVGAttributes<SVGSVGElement> & { size?: number };

export const IncenseIcon = ({ size = 18, ...p }: P) => (
  <svg width={size} height={size} {...base} {...p}>
    <path d="M12 21c-3.5 0-6-1.8-6-4h12c0 2.2-2.5 4-6 4Z" />
    <path d="M12 17V9M9 17v-6M15 17v-6" />
    <path d="M12 6c0-1.2 1-1.6 1-2.8M9 8c0-1 .8-1.4.8-2.4M15 8c0-1 .8-1.4.8-2.4" />
  </svg>
);

export const ArrowRightIcon = ({ size = 16, ...p }: P) => (
  <svg width={size} height={size} {...base} {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const LogoutIcon = ({ size = 18, ...p }: P) => (
  <svg width={size} height={size} {...base} {...p}>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
    <path d="M10 16l-4-4 4-4M6 12h10" />
  </svg>
);
