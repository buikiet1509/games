#!/bin/sh
# Áp migration rồi khởi động server. `exec` để node nhận thẳng tín hiệu tắt (SIGTERM)
# và kịp ghi nốt phước/lời nguyện đang chờ.
set -e

# Neon bản miễn phí tự ngủ khi vắng; lần kết nối đầu phải chờ máy thức dậy, lâu hơn mức
# 5 giây mặc định của Prisma (lỗi P1001). Neon khuyên tăng connect_timeout.
case "$DATABASE_URL" in
  *connect_timeout=*) ;;
  *\?*) export DATABASE_URL="${DATABASE_URL}&connect_timeout=15" ;;
  *) export DATABASE_URL="${DATABASE_URL}?connect_timeout=15" ;;
esac

# Thử lại vài lần phòng khi database chưa sẵn sàng ngay lúc khởi động.
attempt=1
until node_modules/.bin/prisma migrate deploy; do
  if [ "$attempt" -ge 5 ]; then
    echo "Không áp được migration sau $attempt lần thử" >&2
    exit 1
  fi
  echo "Database chưa sẵn sàng, thử lại sau $((attempt * 5)) giây (lần $attempt/5)..." >&2
  sleep $((attempt * 5))
  attempt=$((attempt + 1))
done

exec node dist/index.js
