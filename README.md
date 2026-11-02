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

## Deploy

Hướng dẫn từng bước trong [DEPLOY.md](DEPLOY.md): **miễn phí** với Render + Neon (một địa chỉ, không cần tên miền), hoặc trả phí với Fly.io khi cần chạy 24/7 và nhiều máy. Image Docker chứa cả server lẫn bản build client; server phục vụ luôn trang web và tự chạy migration khi khởi động.

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

- 5 khu, mỗi khu một loại room Colyseus (tối đa 150 người; Chính điện 40 chỗ ngồi). Sơ đồ: **Cổng Tam Quan** (nơi bắt đầu) → **Sân chùa** (lư hương) → hiên điện vào **Chính điện**; từ sân rẽ trái sang **Hồ sen**, rẽ phải sang **Gác chuông**. Bản đồ, lối đi, lối vào ở `AREA_MAPS` (`packages/shared/src/world.ts`). Muốn sang khu khác phải **đứng gần lối vào và bấm vào nó** (cửa điện, lòng cổng, biển chỉ lối); đi ngang qua không tự chuyển. Bấm từ xa thì nhân vật tự đi tới gần, bấm lần nữa để vào. Server kiểm tra khoảng cách (`enter` → `travel`). Tab trên thanh trên vẫn chuyển thẳng.
- Khu đầy thì `joinOrCreate` tự mở bản sao; mỗi bản sao nhận số nhỏ nhất chưa dùng và hiển thị "Chính điện · Khu 2". `GET /api/online` trả tổng số người và theo từng khu.
- Hành động theo khu (`AREA_ACTIONS` trong `packages/shared/src/world.ts`): Sân chùa chỉ thắp hương; lạy Phật, cầu nguyện, công đức trong Chính điện; thỉnh chuông ở Gác chuông. Server từ chối và nhắc nơi cần tới.
- Trong Chính điện mọi người **ngồi cố định trên thảm, không di chuyển**: server xếp chỗ trống gần tượng Phật nhất (5 hàng × 8 chỗ hai bên lối giữa, `HALL_SEATS`), rời đi thì nhường chỗ. Sức chứa mỗi điện = 40 chỗ; đầy thì matchmaking tự mở điện mới. Rời điện bằng nút "Ra Sân chùa".
- Khi lạy, nhân vật trải thảm, quỳ quay lưng về phía người xem (hướng vào bàn thờ) và cúi rạp đúng lúc người đó nhấn giữ.
- Server-authoritative: client chỉ gửi ý định `move_to {x,y}` (click) hoặc `dir {x,y}` (phím); server validate bằng Zod, giới hạn 30 tin/giây, mô phỏng di chuyển + va chạm (`packages/shared/src/world.ts`) ở 12 Hz rồi đồng bộ delta.
- Client nội suy snapshot (trễ 120 ms) nên chuyển động mượt dù server chỉ gửi 12 lần/giây.
- Rớt mạng ngoài ý muốn: server giữ nhân vật 20 giây để client tự nối lại.
- Hành động (server kiểm tra hết, client không tự cộng phước):

  | Hành động    | Quy tắc                                                                                                                           |
  | ------------ | --------------------------------------------------------------------------------------------------------------------------------- |
  | Thắp hương   | Phải đứng gần lư hương (client tự đi tới nếu ở xa), +5 phước, hồi chiêu 60 giây (Redis, đúng cả khi mở nhiều tab)                 |
  | Lạy Phật     | Nhấn giữ 1,2 giây mỗi lạy, server kiểm tra thời gian; đủ 3 lạy +3 phước (tối đa 1 lần/phút); người khác thấy nhãn "đang lạy"      |
  | Công đức     | 10/50/100/500 phước, trừ nguyên tử trong transaction (không bao giờ âm), ghi bảng `Donation`, cập nhật bảng công đức nếu hiện tên |
  | Thỉnh chuông | Chỉ ở Gác chuông, hồi chiêu 5 phút cho cả room                                                                                    |
  | Cầu nguyện   | ≤ 200 ký tự, 1 tin/2 giây, lọc từ thô tục (che bằng `*`, bổ sung qua `PROFANITY_EXTRA`), có nút báo cáo (bảng `Report`)           |

- Điểm danh hằng ngày (theo giờ VN): +20 phước lần đầu vào chùa mỗi ngày.
- Ghi DB theo lô: phước nhận được gom 5 giây/lần, lời nguyện 2 giây/lần; tắt server sẽ ghi nốt phần còn lại.
- Bảng công đức ngày/tuần/tất cả: Redis sorted set, đồng bộ giữa các room qua presence pub/sub; khi Redis trống thì tự dựng lại từ bảng `Donation`. API: `GET /api/leaderboard?period=day|week|all&limit=10`.
- Thử nhanh: mở hai cửa sổ (một cửa sổ thường, một cửa sổ ẩn danh) và đăng nhập hai tài khoản khác nhau.

## Âm thanh & giao diện

- Âm thanh tổng hợp bằng Web Audio (`apps/client/src/audio/sound.ts`), không cần file: chuông gió ở các khu ngoài trời, tiếng mõ chậm trong Chính điện, tiếng chuông chùa cho cả khu khi có người thỉnh, tiếng mõ mỗi lạy. Bật sau thao tác đầu tiên (chính sách tự phát của trình duyệt); nút tắt tiếng trên thanh trên, nhớ lựa chọn trong trình duyệt.
- Camera phóng vừa khung và bám theo nhân vật của mình; đổi khu có hiệu ứng mờ dần.
- Responsive: laptop 1280px đủ chỗ 5 tab; dưới 900px cột phải thành ngăn kéo trượt lên (thanh kéo hiện hoạt động mới nhất), nút "Cầu nguyện" tự mở ngăn kéo.
- Tôn trọng "giảm chuyển động" của hệ điều hành: tắt gợn sóng, lửa nến lung linh, giảm khói hương, camera không trượt.

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
