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

export const BowIcon = ({ size = 22, ...p }: P) => (
  <svg width={size} height={size} {...base} {...p}>
    <circle cx="12" cy="4.5" r="2" />
    <path d="M12 7v5l-4 3M12 12l4 3M7 20h10" />
  </svg>
);

export const DonateIcon = ({ size = 22, ...p }: P) => (
  <svg width={size} height={size} {...base} {...p}>
    <rect x="4" y="8" width="16" height="11" rx="2" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2M10 13h4" />
  </svg>
);

export const BellIcon = ({ size = 22, ...p }: P) => (
  <svg width={size} height={size} {...base} {...p}>
    <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Z" />
    <path d="M10 20.5a2 2 0 0 0 4 0M12 3v2" />
  </svg>
);

export const PrayIcon = ({ size = 22, ...p }: P) => (
  <svg width={size} height={size} {...base} {...p}>
    <path d="M5 5h14v10H10l-4 4v-4H5z" />
    <path d="M9 9.5h6M9 12h4" />
  </svg>
);

export const SendIcon = ({ size = 20, ...p }: P) => (
  <svg width={size} height={size} {...base} {...p}>
    <path d="M20 4 9.5 14.5M20 4l-6.5 16-4-7.5L2 9z" />
  </svg>
);

export const FlagIcon = ({ size = 15, ...p }: P) => (
  <svg width={size} height={size} {...base} {...p}>
    <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
  </svg>
);

export const CloseIcon = ({ size = 18, ...p }: P) => (
  <svg width={size} height={size} {...base} {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
