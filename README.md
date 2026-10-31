# Chùa An Lạc Online

Game web 2D nhiều người chơi: vào khuôn viên chùa, thấy nhau di chuyển theo thời gian thực, cùng thắp hương, lạy Phật, công đức, thỉnh chuông và gửi lời nguyện. Điểm phước là tiền ảo trong game, không dùng tiền thật.

## Cấu trúc

```
apps/client      Vite + Phaser 3 (cảnh game) + Preact (UI phủ lên canvas)
apps/server      Fastify (auth/API) + Colyseus (room multiplayer), cùng một cổng
packages/shared  Hằng số, Zod schema dùng chung client/server
design/          Thiết kế giao diện (PDF)
```

Hạ tầng production: Fly.io (game server), Neon (Postgres), Upstash (Redis), Cloudflare Pages (client).

## Chạy local

Yêu cầu: Node ≥ 22, pnpm 9 (`npm i -g pnpm@9`), Docker (OrbStack hoặc Docker Desktop).

```bash
pnpm install
cp .env.example .env
pnpm db:up        # Postgres + Redis
pnpm --filter @chua/server db:migrate   # tạo bảng (lần đầu / khi đổi schema)
pnpm dev          # client: http://localhost:5173 · server: http://localhost:2567
```

## Lệnh thường dùng

| Lệnh                        | Việc                     |
| --------------------------- | ------------------------ |
| `pnpm test`                 | Chạy test (Vitest)       |
| `pnpm typecheck`            | Kiểm tra kiểu TypeScript |
| `pnpm lint` / `pnpm format` | ESLint / Prettier        |
| `pnpm build`                | Build client + server    |

## Biến môi trường

Xem `.env.example`. Không commit file `.env`.

Client (build time): `VITE_GAME_URL` — địa chỉ WebSocket game server ở production (vd. `wss://api.chua.example.com`). Dev mặc định `ws://<host>:2567`.

## Multiplayer

- Mỗi khu vực là một room Colyseus (hiện có `chinh-dien`), tối đa 150 người.
- Server-authoritative: client chỉ gửi ý định `move_to {x,y}` (click) hoặc `dir {x,y}` (phím); server validate bằng Zod, giới hạn 30 tin/giây, mô phỏng di chuyển + va chạm (`packages/shared/src/world.ts`) ở 12 Hz rồi đồng bộ delta.
- Client nội suy snapshot (trễ 120 ms) nên chuyển động mượt dù server chỉ gửi 12 lần/giây.
- Rớt mạng ngoài ý muốn: server giữ nhân vật 20 giây để client tự nối lại.
- Thử nhanh: mở hai cửa sổ (một cửa sổ thường, một cửa sổ ẩn danh) và đăng nhập hai tài khoản khác nhau.

## API xác thực

| Method | Đường dẫn            | Ghi chú                                                                           |
| ------ | -------------------- | --------------------------------------------------------------------------------- |
| POST   | `/api/auth/register` | `{username, email, password, robeColor}` → `{accessToken, user}` + cookie refresh |
| POST   | `/api/auth/login`    | `{identifier, password, remember?}` — identifier là username hoặc email           |
| POST   | `/api/auth/refresh`  | Đọc cookie `chua_rt`, xoay vòng token                                             |
| POST   | `/api/auth/logout`   | Thu hồi phiên hiện tại                                                            |
| POST   | `/api/auth/forgot`   | `{email}` — luôn trả 202, không lộ email nào tồn tại                              |
| POST   | `/api/auth/reset`    | `{token, password}` — token một lần, hết hạn 30 phút, đăng xuất mọi thiết bị      |
| GET    | `/api/me`            | Header `Authorization: Bearer <accessToken>`                                      |

- Mật khẩu: argon2id (m=19 MiB, t=2), tối thiểu 8 ký tự, chặn mật khẩu phổ biến và mật khẩu chứa username.
- Access token JWT 15 phút, client giữ trong bộ nhớ. Refresh token lưu dạng SHA-256 trong DB, cookie `HttpOnly; Secure; SameSite=Strict; Path=/api/auth`; dùng lại token đã xoay → thu hồi cả chuỗi phiên.
- Rate limit theo IP (Redis) và khoá tài khoản 15 phút sau 5 lần sai liên tiếp.
- Production: client và API phải chung tên miền gốc (vd. `chua.example.com` và `api.chua.example.com`) để cookie `SameSite=Strict` hoạt động.
