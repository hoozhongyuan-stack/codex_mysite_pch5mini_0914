#!/bin/sh
set -eu

mkdir -p "${FILES_DIR:-/data/files}" /data/backups

# Only the public web service receives release credentials. Drop root before it
# handles requests or invokes the Mini Program CI tool.
if [ -n "${MINI_RELEASE_PRIVATE_DIR:-}" ] && [ "$(id -u)" -eq 0 ]; then
  mkdir -p "$MINI_RELEASE_PRIVATE_DIR"
  chown -R node:node "${FILES_DIR:-/data/files}" /data/backups "$MINI_RELEASE_PRIVATE_DIR"
  exec runuser -u node -- "$@"
fi

exec "$@"
