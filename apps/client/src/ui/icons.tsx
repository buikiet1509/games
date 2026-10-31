// Icon SVG nét (không dùng emoji) — kế thừa màu chữ qua currentColor.
import type { JSX } from 'preact';

type IconProps = JSX.SVGAttributes<SVGSVGElement> & { size?: number };

function Icon({
  size = 20,
  children,
  ...rest
}: IconProps & { children: JSX.Element[] | JSX.Element }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const LotusLogo = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="10.5" />
    <path d="M12 6.5c1.6 1.6 2.2 3.4 2.2 5 0 1.8-1 3.3-2.2 4-1.2-.7-2.2-2.2-2.2-4 0-1.6.6-3.4 2.2-5Z" />
    <path d="M9.6 13.6C8 13.4 6.6 12.6 5.8 11.6c-.1 2.6 2.4 4.8 6.2 4.8" />
    <path d="M14.4 13.6c1.6-.2 3-1 3.8-2 .1 2.6-2.4 4.8-6.2 4.8" />
  </Icon>
);

export const EyeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

export const EyeOffIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10.6 5.6A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4" />
    <path d="M6.6 6.6C3.9 8.3 2.5 12 2.5 12S6 18.5 12 18.5c1.9 0 3.5-.6 4.8-1.5" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    <path d="m3 3 18 18" />
  </Icon>
);

export const GoogleIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20.5 12.2c0-.6 0-1.1-.1-1.7H12v3.3h4.8a4.1 4.1 0 0 1-1.8 2.7" />
    <path d="M15 16.5A8.5 8.5 0 1 1 18 6.3" />
  </Icon>
);

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
);

export const ArrowLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M19 12H5" />
    <path d="m11 6-6 6 6 6" />
  </Icon>
);
