#!/bin/sh
set -eu

: "${POSTGRES_APP_PASSWORD:?POSTGRES_APP_PASSWORD is required}"
: "${POSTGRES_IDENTITY_PASSWORD:?POSTGRES_IDENTITY_PASSWORD is required}"
: "${POSTGRES_CMS_RUNTIME_PASSWORD:?POSTGRES_CMS_RUNTIME_PASSWORD is required}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" \
  -v app_password="$POSTGRES_APP_PASSWORD" \
  -v cms_runtime_password="$POSTGRES_CMS_RUNTIME_PASSWORD" \
  -v identity_password="$POSTGRES_IDENTITY_PASSWORD" <<SQL
CREATE ROLE aition_migration LOGIN PASSWORD :'app_password';
CREATE ROLE aition_cms LOGIN PASSWORD :'cms_runtime_password';
CREATE ROLE aition_identity LOGIN PASSWORD :'identity_password';
CREATE DATABASE mysite_cms OWNER aition_migration ENCODING 'UTF8' TEMPLATE template0;
CREATE DATABASE mysite_identity OWNER aition_identity ENCODING 'UTF8' TEMPLATE template0;
SQL
