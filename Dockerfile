FROM node:lts-alpine AS base
RUN corepack enable pnpm

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p server/lib/database/migrations
RUN set -a && . ./.env && set +a && pnpm build

FROM base AS runtime
WORKDIR /app
COPY --from=build /app/.output ./.output
COPY --from=build /app/server/lib/database/migrations ./.output/migrations
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
