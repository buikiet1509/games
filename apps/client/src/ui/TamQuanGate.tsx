/** Cổng Tam Quan nét vàng đồng, vẽ theo thiết kế màn đăng nhập. */
export function TamQuanGate() {
  return (
    <svg
      class="tamquan"
      viewBox="0 0 620 380"
      role="img"
      aria-label="Cổng Tam Quan"
      fill="none"
      stroke="var(--gold-light)"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      {/* Trăng */}
      <circle cx="306" cy="30" r="25" stroke-dasharray="4 7" />
      {/* Mái trên: dải cong, hai đầu đao vểnh */}
      <path d="M18 88c4 20 18 32 40 38" />
      <path d="M598 88c-4 20-18 32-40 38" />
      <path d="M44 120C200 70 412 70 572 120" />
      <path d="M58 128C210 84 402 84 556 128" fill="var(--red)" />
      <path d="M44 120 58 128M572 120l-16 8" />
      <path d="M58 128C210 100 402 100 556 128" />
      {/* Biển hiệu */}
      <rect x="230" y="105" width="154" height="54" fill="var(--red-700)" />
      <text
        x="307"
        y="141"
        text-anchor="middle"
        fill="var(--gold-light)"
        stroke="none"
        font-family="var(--font-heading)"
        font-weight="700"
        font-size="22"
      >
        TAM QUAN
      </text>
      {/* Mái dưới */}
      <path d="M92 152c3 14 12 22 26 26" />
      <path d="M526 152c-3 14-12 22-26 26" />
      <path d="M110 172c60-16 120-22 120-22M384 150s60 6 120 22" />
      <path d="M118 180c60-18 120-24 120-24M376 156s60 6 120 24" />
      {/* Cột */}
      <path d="M148 184v168M196 176v176M418 176v176M466 184v168" />
      {/* Cửa chính vòm */}
      <rect x="240" y="192" width="134" height="160" fill="var(--red-900)" />
      <path d="M240 236c40-34 94-34 134 0" />
      {/* Nền */}
      <path d="M4 352h612" />
    </svg>
  );
}
