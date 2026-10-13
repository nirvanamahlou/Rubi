FROM node:24-bookworm-slim AS build

WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@11.19.0 --activate

COPY . .
RUN pnpm install --frozen-lockfile
RUN DATABASE_URL=postgresql://rubi_local:rubi_local_dev@postgres:5432/rubi pnpm db:generate

RUN pnpm exec turbo run build --filter=@nora/api

FROM node:24-bookworm-slim AS runtime
WORKDIR /workspace
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@11.19.0 --activate
COPY --from=build /workspace /workspace

EXPOSE 3000 4000
