FROM node:22-alpine AS build
RUN apk add --no-cache openssl
RUN npm i -g pnpm@9.15.0
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/server/package.json apps/server/
COPY apps/server/prisma apps/server/prisma
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @chua/server...
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/server apps/server
RUN pnpm --filter @chua/server build \
 && pnpm --filter @chua/server deploy --prod /out \
 && cd /out && npx prisma generate

FROM node:22-alpine
RUN apk add --no-cache openssl
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/package.json ./
COPY --from=build /out/prisma ./prisma
COPY --from=build /repo/apps/server/dist ./dist
USER node
EXPOSE 2567
CMD ["node", "dist/index.js"]
