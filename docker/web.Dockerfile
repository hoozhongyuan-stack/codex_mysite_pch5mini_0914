FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN sed -i 's|http://deb.debian.org/debian|http://mirrors.aliyun.com/debian|g; s|http://deb.debian.org/debian-security|http://mirrors.aliyun.com/debian-security|g' /etc/apt/sources.list.d/debian.sources
RUN corepack enable && apt-get update \
  && apt-get install -y -o Acquire::http::Timeout=30 -o Acquire::Retries=3 --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ARG NEXT_PUBLIC_DEPLOY_ENV=Production
ENV NEXT_PUBLIC_DEPLOY_ENV=${NEXT_PUBLIC_DEPLOY_ENV}

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
RUN pnpm config set registry https://registry.npmmirror.com
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
ARG MINI_API_ORIGIN=https://aition.art
RUN pnpm --dir miniapp install --frozen-lockfile \
  && MINI_API_ORIGIN="$MINI_API_ORIGIN" pnpm --dir miniapp build
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
