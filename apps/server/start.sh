#!/bin/sh
# Áp migration rồi khởi động server. `exec` để node nhận thẳng tín hiệu tắt (SIGTERM)
# và kịp ghi nốt phước/lời nguyện đang chờ.
set -e
node_modules/.bin/prisma migrate deploy
exec node dist/index.js
