# Prompt cho Claude Code — Game "Chùa An Lạc Online"

> Cách dùng: tạo một thư mục dự án trống, đặt các file thiết kế (xuất từ canvas "Chùa Online – Giao diện": ảnh PNG hoặc PDF của 3 màn hình) vào thư mục `design/`, rồi dán toàn bộ phần dưới đây vào Claude Code.

---

## Vai trò & mục tiêu

Bạn là kỹ sư full-stack giàu kinh nghiệm về game multiplayer thời gian thực. Hãy xây dựng **"Chùa An Lạc Online"** — một game web 2D nhiều người chơi, nơi người chơi đăng nhập, vào khuôn viên chùa, nhìn thấy nhau di chuyển theo thời gian thực, và cùng thực hiện các hành động: **thắp hương, lạy Phật, công đức, thỉnh chuông, gửi lời nguyện**.

Yêu cầu cốt lõi:

1. **Chịu tải nhiều người chơi cùng lúc** (mục tiêu ban đầu: 1.000+ người online đồng thời, kiến trúc mở rộng ngang được lên hàng chục nghìn).
2. **Chạy hoàn toàn trên cloud** — máy local chỉ dùng để code; không phụ thuộc tài nguyên máy cá nhân khi vận hành.
3. **Bắt buộc đăng nhập bằng tài khoản + mật khẩu**, bảo mật chuẩn công nghiệp.
4. **Giao diện đơn giản nhưng không đơn điệu**, bám sát thiết kế trong thư mục `design/` và đặc tả bên dưới.

Trước khi code: đọc các file trong `design/`, sau đó trình bày kế hoạch ngắn (kiến trúc, cấu trúc thư mục, các mốc) và chờ tôi xác nhận. Sau đó làm theo từng mốc, mỗi mốc phải chạy được và có test.

---

## Tech stack (dùng đúng, trừ khi có lý do rõ ràng — nếu đổi, giải thích)

- **Monorepo**: pnpm workspaces — `apps/client`, `apps/server`, `packages/shared` (kiểu dữ liệu, hằng số, schema dùng chung).
- **Ngôn ngữ**: TypeScript ở mọi nơi, `strict: true`.
- **Client**: Vite + **Phaser 3** cho cảnh game 2D; UI (đăng nhập, panel, modal) dùng HTML/CSS thường hoặc Preact đặt chồng lên canvas Phaser.
- **Game server**: Node.js + **Colyseus** (room-based, server-authoritative, đồng bộ state bằng delta qua `@colyseus/schema`).
- **API/Auth server**: cùng process Node (Express hoặc Fastify) chạy cạnh Colyseus.
- **Database**: **PostgreSQL** + Prisma ORM.
- **Cache / scale**: **Redis** — Colyseus `RedisPresence` + `RedisDriver` để chạy nhiều instance, rate limit, session.
- **Hạ tầng**: Docker; deploy lên **Fly.io** (hoặc Render/Railway — chọn một và viết hướng dẫn). Postgres & Redis dùng dịch vụ managed (Neon/Supabase cho Postgres, Upstash cho Redis). Client build tĩnh, host trên Cloudflare Pages hoặc Vercel.
- **CI**: GitHub Actions — lint, typecheck, test, build Docker image.

---

## Bảo mật tài khoản (bắt buộc)

- Hash mật khẩu bằng **argon2id** (thư viện `argon2`), tuyệt đối không lưu/ghi log mật khẩu dạng thô.
- Chính sách mật khẩu: tối thiểu 8 ký tự, kiểm tra không nằm trong danh sách mật khẩu phổ biến.
- Đăng ký: username (3–20 ký tự, a-z 0-9 _), email, mật khẩu. Validate mọi input bằng **Zod** ở server (schema để trong `packages/shared`).
- Phiên đăng nhập: **access token ngắn hạn (15 phút) + refresh token xoay vòng** lưu trong cookie `HttpOnly; Secure; SameSite=Strict`. Refresh token lưu dạng hash trong DB, thu hồi được khi đăng xuất.
- Kết nối WebSocket vào room Colyseus phải xác thực token trong `onAuth`; không có token hợp lệ → từ chối.
- Chống brute-force: rate limit theo IP và theo tài khoản (Redis), khoá tạm 15 phút sau 5 lần sai liên tiếp; thông báo lỗi chung chung ("Sai tên đăng nhập hoặc mật khẩu").
- HTTPS bắt buộc ở production; `helmet` cho security headers; CORS chỉ cho phép domain client.
- Quên mật khẩu: token một lần, hết hạn 30 phút, gửi qua email (dùng Resend hoặc SMTP; để dạng interface, có bản mock cho môi trường dev).
- Lời nguyện/chat: escape khi hiển thị (chống XSS), giới hạn độ dài 200 ký tự, rate limit 1 tin/2 giây, lọc từ ngữ thô tục (danh sách cấu hình được), có nút báo cáo.
- Bí mật (DB URL, JWT secret…) chỉ qua biến môi trường; có `.env.example`, không commit `.env`.
- (Tuỳ chọn, mốc sau) Đăng nhập Google OAuth.

---

## Kiến trúc multiplayer & khả năng chịu tải

- **Server-authoritative**: client chỉ gửi _ý định_ (di chuyển tới điểm X, bấm "lạy Phật"); server kiểm tra hợp lệ, cập nhật state rồi phát cho mọi người. Client không bao giờ tự cộng điểm phước.
- **Khu vực = room**: `cong-tam-quan`, `san-chua`, `chinh-dien`, `ho-sen`, `gac-chuong`. Mỗi room giới hạn ~150 người; khi đầy, tự tạo bản sao (ví dụ "Chính điện · Khu 2") — hiển thị tên khu cho người chơi.
- **Tick rate** 10–15 Hz cho vị trí; client nội suy (interpolation) để chuyển động mượt.
- **Interest management**: chỉ gửi đầy đủ dữ liệu người chơi trong bán kính nhìn thấy; người ở xa vẽ dạng mờ/đơn giản.
- **Scale ngang**: nhiều instance game server sau load balancer, chia sẻ trạng thái qua Redis presence; matchmaking của Colyseus tự phân phối room.
- Lưu dữ liệu bền (tài khoản, tổng phước, lịch sử công đức, lời nguyện) vào Postgres theo lô/bất đồng bộ — không ghi DB mỗi tick.
- Bảng công đức (leaderboard ngày/tuần/tất cả) dùng **Redis sorted set**, đồng bộ định kỳ xuống Postgres.
- Có endpoint `/health` và log có cấu trúc (pino).
- **Load test**: viết script bằng `@colyseus/loadtest` (hoặc k6) giả lập 1.000 client di chuyển + thao tác; báo cáo CPU/RAM/độ trễ, đề xuất cấu hình máy.

---

## Gameplay

| Hành động    | Mô tả                                                                                    | Quy tắc server                                                                 |
| ------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Di chuyển    | Click vào sân hoặc WASD/phím mũi tên                                                     | Giới hạn tốc độ, va chạm cơ bản với chướng ngại (lư hương, cây)                |
| Thắp hương   | Đứng gần lư hương → animation cắm 3 nén hương, khói bay lên mọi người đều thấy           | +5 phước, hồi chiêu 60 giây                                                    |
| Lạy Phật     | Nhấn giữ nút; nhân vật cúi lạy, đủ 3 lạy                                                 | +3 phước khi đủ 3 lạy, người khác thấy nhãn "đang lạy"                         |
| Công đức     | Mở modal, chọn 10/50/100/500 phước, chọn hồi hướng, lời nguyện tuỳ chọn, tuỳ chọn ẩn tên | Trừ điểm phước, ghi lịch sử, cập nhật bảng công đức, phát thông báo "+X phước" |
| Thỉnh chuông | Chỉ ở Gác chuông                                                                         | Âm thanh chuông phát cho cả room, hồi chiêu 5 phút/room                        |
| Cầu nguyện   | Gửi lời nguyện vào khung hoạt động + bong bóng thoại trên đầu nhân vật 5 giây            | Rate limit + lọc nội dung                                                      |

- **Điểm phước là tiền ảo trong game**, không dùng tiền thật. Người mới nhận 100 phước; nhận thêm qua điểm danh hằng ngày và các hành động trên. (Nếu sau này muốn công đức bằng tiền thật thì để thành mốc riêng, cần cổng thanh toán và tư vấn pháp lý — không làm ở phiên bản này.)
- Nhân vật: chọn màu áo (5–6 màu) khi đăng ký; tên hiển thị trên đầu.
- Âm thanh nền nhẹ (tiếng chuông gió, mõ), có nút tắt tiếng.
- Tôn trọng không khí trang nghiêm: không có PvP, không có hiệu ứng lố.

---

## Đặc tả giao diện (bám theo `design/`)

**Màu sắc**

- Nền giấy dó: `#F4EBD9` · Thẻ/panel: `#FFFBF2` · Viền: `#E3D3B3` / input `#D6C3A0`
- Đỏ son (chính): `#8B1E1E`, đậm `#7A1717`, `#5E1212`
- Vàng đồng (nhấn, trang trí): `#C9932E`, nhạt `#E7C27A`, chữ vàng trên nền sáng `#6B4A10`
- Chữ chính `#2B1B12`, chữ phụ `#4A3527` / `#6B5240`
- Xanh ngọc (thành công, trạng thái "đang lạy"): `#2F6B5A`

**Font** (hỗ trợ tiếng Việt đầy đủ): tiêu đề **Noto Serif** 700; nội dung **Be Vietnam Pro** 400/500/600/700.

**Bo góc & khoảng cách**: nút/ô nhập 10–12px, thẻ 18–20px, viên thuốc 999px; lưới 4/8px; vùng bấm tối thiểu 44px.

**Màn 1 — Đăng nhập/Đăng ký**: chia đôi; trái nền đỏ son với hình cổng Tam Quan nét vàng đồng + khẩu hiệu "Cùng nhau đi chùa, dù ở bất cứ đâu"; phải là thẻ form có tab Đăng nhập/Đăng ký, ô tên đăng nhập/email, mật khẩu có nút hiện/ẩn, "Ghi nhớ đăng nhập", nút "Vào chùa", "Tiếp tục với Google", ghi chú bảo mật nhỏ có biểu tượng ổ khoá.

**Màn 2 — Sân chùa (màn chơi chính)**:

- Thanh trên (đỏ son, cao 72px): logo, tab khu vực (Cổng Tam Quan / Sân chùa / Chính điện / Hồ sen / Gác chuông), số người đang online (chấm xanh), điểm phước, avatar tài khoản.
- Giữa: cảnh 2D Phaser — chính điện mái cong, lư hương có khói, cây bồ đề, nền sân lát đá; nhân vật có tên trên đầu, nhân vật của mình có vòng vàng và nhãn "Bạn"; nhãn nổi "+10 phước" khi có người công đức; bong bóng lời nguyện.
- Góc trái trên: tên khu + số người tại đây, gợi ý điều khiển.
- Đáy giữa: thanh hành động 5 nút có biểu tượng (Thắp hương nổi bật màu đỏ son, còn lại nền kem).
- Cột phải 360px: "Bảng công đức hôm nay" (top 3, hạng 1 nền vàng nhạt), luồng "Hoạt động & lời nguyện" cập nhật realtime, ô gửi lời nguyện.

**Màn 3 — Công đức & Lạy Phật**: nền cảnh chùa tối mờ; toast trên cùng "Bạn đã lạy Phật đủ 3 lạy · +3 phước"; thẻ Lạy Phật (vòng tiến độ vàng đồng, 3 chấm đếm lạy, nút nhấn giữ); modal Công đức (chọn mức 10/50/100/500 dạng lưới, mức đang chọn viền đỏ son, select "Hồi hướng cho", ô lời nguyện, checkbox hiện tên, nút "Để sau" và "Dâng X phước").

**Nguyên tắc**: không dùng emoji làm icon (dùng SVG nét), không gradient loè loẹt, tương phản chữ ≥ 4.5:1, dùng phần tử HTML chuẩn (`button`, `label`, `input`) để truy cập được bằng bàn phím, giao diện co giãn được trên màn laptop 1280px; trên điện thoại cột phải thu thành ngăn kéo trượt lên.

---

## Mốc triển khai

1. **Khung dự án**: monorepo, Docker Compose cho dev (Postgres + Redis), lint/format, CI.
2. **Auth**: đăng ký, đăng nhập, refresh, đăng xuất, quên mật khẩu, rate limit + khoá tạm; test đầy đủ (Vitest + Supertest).
3. **Màn đăng nhập/đăng ký** theo thiết kế, nối API thật.
4. **Room multiplayer**: 1 room "Chính điện", di chuyển + đồng bộ + nội suy; mở 2 tab trình duyệt thấy nhau.
5. **Hành động**: thắp hương, lạy Phật, công đức, lời nguyện, thỉnh chuông + điểm phước + bảng công đức.
6. **Đủ 5 khu vực**, chuyển khu, tự chia bản sao khi đầy.
7. **Hoàn thiện UI/âm thanh/animation** theo thiết kế; responsive.
8. **Deploy cloud**: Dockerfile, cấu hình Fly.io (hoặc nền tảng đã chọn), managed Postgres/Redis, domain + HTTPS; viết `DEPLOY.md` từng bước cho người mới.
9. **Load test & tối ưu**: chạy script 1.000 client, báo cáo kết quả, chỉnh tick rate/interest management nếu cần.

## Yêu cầu chung

- Code sạch, chia module rõ ràng, comment ngắn gọn ở chỗ khó.
- Mỗi mốc: chạy test, tự kiểm tra trên trình duyệt, rồi tóm tắt việc đã làm và việc còn lại.
- Viết `README.md` (tiếng Việt): cách chạy local, biến môi trường, kiến trúc, cách deploy.
- Khi có quyết định quan trọng chưa rõ (chọn nền tảng cloud, chi phí), hỏi tôi trước.
