# Image chạy API + game server, kèm luôn bản build của client (server phục vụ trang web).
FROM node:22-alpine AS build
RUN apk add --no-cache openssl
RUN npm i -g pnpm@9.15.0
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/server/package.json apps/server/
COPY apps/server/prisma apps/server/prisma
COPY apps/client/package.json apps/client/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @chua/server... --filter @chua/client...
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/client apps/client
COPY apps/server apps/server
# Client cùng địa chỉ với API → không đặt VITE_API_URL (gọi /api, WebSocket về chính trang).
RUN pnpm --filter @chua/client build \
 && pnpm --filter @chua/server build \
 && pnpm --filter @chua/server deploy --prod /out \
 && cd /out && npx prisma generate

FROM node:22-alpine
RUN apk add --no-cache openssl
ENV NODE_ENV=production
ENV SERVE_CLIENT_DIR=/app/public
WORKDIR /app
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/package.json ./
COPY --from=build /out/prisma ./prisma
COPY --from=build /repo/apps/server/dist ./dist
COPY --from=build /repo/apps/client/dist ./public
COPY apps/server/start.sh ./start.sh
USER node
EXPOSE 2567
# Chạy migration (có khoá, nhiều máy cùng chạy vẫn an toàn) rồi khởi động server.
CMD ["sh", "./start.sh"]
