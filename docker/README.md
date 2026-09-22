# Production Docker Deployment

This directory contains the Docker deployment template for the `mysite_codex`
production site on `aition.art`. It is designed to coexist with the existing
`aition-ows` project on the same server.

## Isolation Rules

- Do not reuse `aition-ows` container names, volumes, databases, or source path.
- Keep this project under a separate directory such as `/opt/mysite-codex`.
- Keep persistent data under `/opt/mysite-codex/data`.
- Keep production secrets only in an ignored `.env.production` file on the server.
- Let the existing edge Caddy own public ports `80` and `443`; this project only
  exposes `mysite-codex-web:3001` on the shared Docker network.

## First-Time Server Preparation

Create a shared edge network once:

```sh
docker network create aition-shared-edge
docker network connect aition-shared-edge aition-ows-caddy
```

The second command is safe if `aition-ows-caddy` is the current edge proxy. It
lets that Caddy container resolve `mysite-codex-web` by container name after this
project starts.

## Deploy

Clone the clean production repository into a separate path:

```sh
git clone https://github.com/hoozhongyuan-stack/codex_mysite_pch5mini_0914 /opt/mysite-codex
cd /opt/mysite-codex
cp docker/.env.production.example docker/.env.production
chmod 600 docker/.env.production
```

Fill `docker/.env.production` with fresh random values. Do not commit or print
those values. The `POSTGRES_*_PASSWORD` values are interpolated into
PostgreSQL URLs, so generate them with URL-safe characters such as
`A-Za-z0-9` unless you percent-encode them first.

Build and start:

```sh
docker compose --env-file docker/.env.production -f docker/compose.prod.yml up -d --build
```

Then add the `aition.art` host block from
`docker/Caddyfile.aition-art.example` to the existing edge Caddy config and
reload Caddy.

## Verification

```sh
docker compose --env-file docker/.env.production -f docker/compose.prod.yml ps
docker logs --tail 80 mysite-codex-web
docker logs --tail 80 mysite-codex-identity
curl -I --resolve aition.art:443:8.152.204.21 https://aition.art
```

Browser, payment, email, mini-program, and user acceptance checks remain
separate from container startup.
