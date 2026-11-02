# Đưa Chùa An Lạc Online lên cloud

Hướng dẫn từng bước cho người mới. Làm lần lượt từ trên xuống; mỗi bước có phần **Kiểm tra** để biết đã làm đúng chưa.

Có hai cách:

- **Phần A — Miễn phí (Render + Neon)**: không cần thẻ, không cần mua tên miền. Phù hợp chơi vui với bạn bè.
- **Phần B — Trả phí (Fly.io)**: chạy 24/7, mở rộng nhiều máy khi đông người. Làm sau, khi cần.

---

# Phần A — Deploy miễn phí với Render + Neon

## Sơ đồ

```
Người chơi ──► https://chua-an-lac.onrender.com     Render (miễn phí)
                 │  một địa chỉ duy nhất: trang web + API + game server (WebSocket)
                 │
                 ├─► Render Key Value (Redis, miễn phí)
                 └─► Neon (PostgreSQL, miễn phí)
```

Server phục vụ luôn trang web, nên trang và API cùng một địa chỉ — cookie đăng nhập hoạt động mà không cần tên miền riêng.

## Giới hạn của bản miễn phí

Chính sách miễn phí có thể thay đổi — xem lại [render.com/docs/free](https://render.com/docs/free) và [neon.com/pricing](https://neon.com/pricing) trước khi dùng. Tại thời điểm viết (11/2026):

| Giới hạn                                                                          | Ảnh hưởng tới game                                                                                                                          |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Render **ngủ sau 15 phút** không có ai (tin nhắn WebSocket cũng tính là có người) | Người vào đầu tiên sau khi vắng phải **chờ khoảng 1 phút** để máy thức dậy. Đang có người chơi thì máy không ngủ                            |
| Máy Render free yếu (512 MB RAM, CPU nhỏ)                                         | Đủ cho khoảng vài chục người chơi cùng lúc                                                                                                  |
| Render free: 750 giờ máy/tháng, băng thông khoảng 5 GB/tháng                      | Đủ cho một service chạy cả tháng; mỗi lượt vào tải khoảng 0,5 MB, chơi thì tốn thêm chút ít                                                 |
| Redis free của Render lưu trong bộ nhớ, có thể bị khởi động lại bất cứ lúc nào    | Mất hồi chiêu thắp hương/rate limit tạm thời — **không mất** tài khoản, phước, lịch sử công đức (nằm ở Postgres); bảng công đức tự dựng lại |
| Neon free: 0,5 GB lưu trữ, 100 giờ tính toán/tháng, tự ngủ sau 5 phút không dùng  | Đủ cho game vui; Neon chỉ chạy khi server Render đang thức                                                                                  |
| Không có email                                                                    | Chức năng **quên mật khẩu tắt** (báo "chưa bật"). Muốn bật cần tên miền riêng + Resend — xem cuối Phần A                                    |

## Bước 1 — Đưa code lên GitHub

1. Tạo tài khoản [GitHub](https://github.com) nếu chưa có, rồi tạo repo mới (có thể để **Private**), ví dụ `chua-an-lac`.
2. Trong thư mục dự án:
   ```bash
   git remote add origin https://github.com/<tài-khoản>/chua-an-lac.git
   git push -u origin main
   ```

**Kiểm tra**: tab **Actions** trên GitHub có workflow **CI** chạy xanh.

## Bước 2 — Cơ sở dữ liệu (Neon)

1. Đăng ký [Neon](https://neon.tech) (dùng tài khoản GitHub cho nhanh).
2. **New Project** → tên `chua-an-lac` → **Region: AWS Asia Pacific (Singapore)**.
3. Trên trang project → **Connect** → tắt **Connection pooling** → copy chuỗi kết nối dạng:
   ```
   postgresql://<user>:<mật-khẩu>@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
   Dùng chuỗi **không có** chữ `-pooler` trong tên máy (cần kết nối trực tiếp để tạo bảng).

**Kiểm tra**: bạn có một chuỗi bắt đầu bằng `postgresql://` và có `sslmode=require`. Lưu tạm vào ghi chú, **không** dán vào code hay gửi cho ai.

## Bước 3 — Tạo service trên Render

1. Đăng ký [Render](https://render.com) bằng tài khoản GitHub, cho phép Render đọc repo `chua-an-lac`.
2. **New** → **Blueprint** → chọn repo `chua-an-lac`. Render đọc file `render.yaml` và đề xuất tạo:
   - web service **chua-an-lac** (Docker, gói Free, Singapore),
   - Key Value **chua-an-lac-redis** (Redis, gói Free).
3. Render hỏi giá trị **DATABASE_URL** → dán chuỗi Neon ở Bước 2. (`JWT_ACCESS_SECRET` Render tự sinh, `REDIS_URL` tự nối.)
4. **Apply**. Lần đầu build mất khoảng 5–10 phút.

> Nếu tên `chua-an-lac` đã có người dùng, Render đặt tên khác — địa chỉ sẽ là `https://<tên>.onrender.com`. Server tự nhận địa chỉ này, không cần sửa gì.

**Kiểm tra**: trong Render, service **chua-an-lac** hiện **Live**. Mở `https://chua-an-lac.onrender.com/health` thấy `{"status":"ok",...}`. Tab **Logs** có dòng `Server đang chạy`.

## Bước 4 — Kiểm tra IP người dùng (một lần)

Giới hạn đăng nhập sai/đăng ký dựa vào IP người chơi. Mở:

```
https://chua-an-lac.onrender.com/api/ip
```

So với IP thật của bạn (tra "what is my ip" trên Google).

- **Trùng** → xong.
  Server tự dùng header `cf-connecting-ip` khi chạy trên Render (Render đứng sau Cloudflare), nên thường đã đúng. `/api/ip` cũng trả về các header IP mà proxy gửi, để đối chiếu.

- **Khác** (thường là IP của máy chủ trung gian) → trong Render → service → **Environment**, thử lần lượt và mở lại `/api/ip` sau mỗi lần lưu:
  1. thêm `CLIENT_IP_HEADER` = `true-client-ip`;
  2. nếu vẫn sai: xoá biến trên, đổi `TRUST_PROXY_HOPS` thành `2`.

Nếu không làm bước này, game vẫn chạy; chỉ là khi đông người, giới hạn đăng nhập có thể tính chung cho nhiều người.

## Bước 5 — Chơi thử

Mở `https://chua-an-lac.onrender.com` và làm lần lượt:

- [ ] Đăng ký tài khoản → vào Cổng Tam Quan, thanh trên hiện phước 120 (100 + điểm danh 20).
- [ ] Nhấn F5 → vẫn đăng nhập.
- [ ] Mở thêm **cửa sổ riêng tư**, đăng ký tài khoản thứ hai → hai nhân vật thấy nhau.
- [ ] Ra Sân chùa thắp hương; vào Chính điện lạy Phật, công đức, gửi lời nguyện → cửa sổ kia thấy hoạt động và bảng công đức.
- [ ] Ra Gác chuông thỉnh chuông → cả hai cửa sổ nghe tiếng chuông.
- [ ] Mở trên điện thoại → cột phải thành ngăn kéo, chơi được bằng chạm.

Gửi địa chỉ cho bạn bè là chơi cùng được. Mỗi lần push code lên `main`, Render tự build và deploy lại.

## Giữ máy không ngủ (tuỳ chọn)

Có thể dùng dịch vụ "ping" miễn phí (vd. UptimeRobot) gọi `/health` mỗi 10 phút để máy không ngủ. Lưu ý: chạy liên tục cả tháng dùng gần hết 750 giờ miễn phí, và cần xem điều khoản hiện tại của Render có cho phép không.

## Bật quên mật khẩu (tuỳ chọn, cần tên miền riêng)

Email phải gửi từ tên miền bạn sở hữu. Khi đã có tên miền:

1. [Resend](https://resend.com) → **Domains** → thêm tên miền → tạo các bản ghi DNS Resend yêu cầu → chờ **Verified**.
2. **API Keys** → tạo key → copy `re_...`.
3. Render → service → **Environment** → thêm:
   - `RESEND_API_KEY` = `re_...`
   - `MAIL_FROM` = `Chùa An Lạc <no-reply@tên-miền-của-bạn>`

## Sự cố thường gặp (Render)

| Hiện tượng                                                | Cách xử lý                                                                                                            |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Mở trang chờ lâu rồi mới hiện                             | Bình thường với bản miễn phí: máy đang thức dậy (khoảng 1 phút)                                                       |
| Build lỗi ở bước `pnpm install`                           | Xem tab **Logs** của lần deploy; thường do repo thiếu file `pnpm-lock.yaml` — chạy `pnpm install` rồi commit file này |
| Service không lên, log báo "Biến môi trường không hợp lệ" | Kiểm tra `DATABASE_URL` trong **Environment** (đúng chuỗi Neon)                                                       |
| Log báo lỗi kết nối Postgres / migration                  | Chuỗi Neon phải có `sslmode=require` và không phải host `-pooler`                                                     |
| "Không vào được chùa lúc này"                             | Tải lại trang; xem **Logs** có lỗi không                                                                              |
| Mất hồi chiêu / bảng công đức trống một lúc               | Redis free vừa khởi động lại — bảng công đức tự dựng lại từ Postgres ở lần khởi động server kế tiếp                   |

---

# Phần B — Trả phí với Fly.io (khi cần chạy 24/7, đông người)

Repo đã có sẵn `fly.toml` và workflow tự deploy. Khác biệt chính so với Phần A: máy không ngủ, cấu hình khoẻ hơn, chạy được nhiều máy (room chia sẻ qua Redis, WebSocket tới nhầm máy được chuyển bằng header `fly-replay`).

Ước tính khoảng 10–15 USD/tháng cho mỗi máy shared-cpu-2x 1 GB — **xem lại trang giá Fly.io** trước khi dùng. Fly.io không còn gói miễn phí cho tài khoản mới.

## B1 — Chuẩn bị

- Postgres: dùng lại Neon ở Phần A (hoặc tạo project mới).
- Redis: [Upstash](https://upstash.com) region Singapore, bật TLS → chuỗi `rediss://...`; hoặc `fly redis create`.
- Cài flyctl: `brew install flyctl`, rồi `fly auth login`.

## B2 — Deploy

```bash
fly launch --no-deploy --copy-config --name chua-an-lac --region sin
fly secrets set \
  DATABASE_URL='postgresql://...neon.tech/neondb?sslmode=require' \
  REDIS_URL='rediss://default:...@xxxx.upstash.io:6379' \
  JWT_ACCESS_SECRET="$(openssl rand -base64 48)" \
  CLIENT_ORIGIN='https://chua-an-lac.fly.dev'
fly deploy
```

Server phục vụ luôn trang web như Phần A, nên mở thẳng `https://chua-an-lac.fly.dev` là chơi được.

**Kiểm tra**: `fly status` (health check passing), `curl https://chua-an-lac.fly.dev/health`, rồi làm checklist ở Bước 5 Phần A. Kiểm tra IP như Bước 4 (trên Fly mặc định `TRUST_PROXY_HOPS=1` thường đã đúng).

## B3 — Tên miền riêng (tuỳ chọn)

```bash
fly certs add chua.example.com
```

Trong DNS của tên miền: bản ghi `CNAME chua → chua-an-lac.fly.dev` (nếu dùng Cloudflare thì để **DNS only**). Sau đó `fly secrets set CLIENT_ORIGIN='https://chua.example.com'`.

## B4 — Tự deploy khi push

`fly tokens create deploy -x 999999h` → GitHub → **Settings** → **Secrets and variables** → **Actions**:

- tab **Secrets**: thêm `FLY_API_TOKEN` = token vừa tạo;
- tab **Variables**: thêm `FLY_DEPLOY` = `true`.

Workflow **Deploy** tự chạy sau khi **CI** xanh trên `main` (khi chưa bật `FLY_DEPLOY` thì bỏ qua, không báo lỗi).

## B5 — Mở rộng

```bash
fly scale count 2            # nhiều máy, room chia sẻ qua Redis
fly scale vm shared-cpu-4x   # hoặc máy khoẻ hơn
```

Chỉ chạy nhiều máy trong **cùng một vùng** (`sin`). Mỗi khu đầy (150 người, Chính điện 40) tự mở bản sao "Khu 2", "Khu 3"…

Xem log: `fly logs`. Vào máy: `fly ssh console`.
