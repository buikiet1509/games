// In ra DATABASE_URL dùng được trên nền tảng không có IPv6 ra ngoài (vd. Render).
//
// Hostname Neon có cả bản ghi IPv4 lẫn IPv6; Render không đi ra được bằng IPv6 nên Prisma
// treo tới hết thời gian chờ (lỗi P1001). Cách sửa: thay hostname bằng địa chỉ IPv4.
// Nối bằng IP thì Neon không đọc được tên endpoint từ SNI, nên báo endpoint qua mật khẩu
// theo dạng Neon hỗ trợ: `endpoint=<endpoint-id>$<mật khẩu>`.
//
// Nối bằng IP thì Neon không ràng buộc kênh TLS (channel binding) → `require` hạ xuống
// `prefer`; kết nối vẫn mã hoá TLS (sslmode=require).
//
// Chỉ bật khi chạy trên Render (biến RENDER=true) hoặc DB_FORCE_IPV4=true; lỗi thì giữ nguyên chuỗi.
import { lookup } from 'node:dns/promises';
import process from 'node:process';

const raw = process.env.DATABASE_URL ?? '';
const enabled =
  process.env.DB_FORCE_IPV4 === 'true' ||
  (process.env.RENDER === 'true' && process.env.DB_FORCE_IPV4 !== 'false');

async function ipv4Url(input) {
  const url = new URL(input);
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(url.hostname)) return input; // đã là IPv4
  const { address } = await lookup(url.hostname, { family: 4 });
  if (
    url.hostname.endsWith('.neon.tech') &&
    !decodeURIComponent(url.password).startsWith('endpoint=')
  ) {
    const endpoint = url.hostname.split('.')[0].replace(/-pooler$/, '');
    url.password = encodeURIComponent(`endpoint=${endpoint}$${decodeURIComponent(url.password)}`);
  }
  if (url.searchParams.get('channel_binding') === 'require') {
    url.searchParams.set('channel_binding', 'prefer');
  }
  url.hostname = address;
  return url.toString();
}

let out = raw;
if (enabled && raw) {
  try {
    out = await ipv4Url(raw);
    console.error(`[db-url] Kết nối database qua IPv4 (${new URL(out).hostname})`);
  } catch (err) {
    console.error(`[db-url] Không đổi được sang IPv4, giữ nguyên chuỗi kết nối: ${err.message}`);
  }
}
process.stdout.write(out);
