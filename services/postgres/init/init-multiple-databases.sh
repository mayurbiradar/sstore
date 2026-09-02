#!/usr/bin/env bash
set -Eeuo pipefail

for database in auth_db order_db product_db; do
  if [[ "${POSTGRES_DB:-}" != "$database" ]]; then
    printf 'Creating database %s\n' "$database"
    psql --username "$POSTGRES_USER" --dbname "${POSTGRES_DB:-postgres}" --set ON_ERROR_STOP=on \
      --command "CREATE DATABASE \"$database\"" 2>/dev/null || true
  fi
done
