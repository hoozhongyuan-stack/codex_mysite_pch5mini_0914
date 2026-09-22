FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
ENV DEPLOY_TARGET=node
RUN pnpm run build:uat

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3001
WORKDIR /app
COPY --from=build /app ./
RUN mkdir -p /data/files /data/backups && chmod +x docker/web-entrypoint.sh
EXPOSE 3001
ENTRYPOINT ["docker/web-entrypoint.sh"]
CMD ["node", "dist/standalone/server.js"]
