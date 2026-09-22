#!/bin/sh
set -eu

mkdir -p "${FILES_DIR:-/data/files}" /data/backups

exec "$@"
