FROM node:24-bookworm-slim AS build

WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@11.19.0 --activate

COPY . .
RUN pnpm install --frozen-lockfile
RUN DATABASE_URL=postgresql://rubi_local:rubi_local_dev@postgres:5432/rubi pnpm db:generate

ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_ASSISTANT_AGENT_ENABLED=false
ARG NEXT_PUBLIC_NORA_MODEL_PLANNER_ENABLED=false
RUN pnpm exec turbo run build --filter=@nora/api --filter=@nora/web
RUN if [ "$NEXT_PUBLIC_ASSISTANT_AGENT_ENABLED" = "true" ]; then node scripts/operations/nora-agent/verify-web-build.mjs; fi

FROM node:24-bookworm-slim AS runtime
WORKDIR /workspace
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@11.19.0 --activate
COPY --from=build /workspace /workspace

EXPOSE 3000 4000
