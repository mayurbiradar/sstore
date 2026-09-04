#!/usr/bin/env bash
set -Eeuo pipefail

# One database per bounded context. Each service owns its schema, no cross-service joins.
# Prefer the comma-separated POSTGRES_MULTIPLE_DATABASES env var; fall back to a
# sensible default list so existing mounts without the env var still get the
# required databases (notably review_db, which is easy to miss in the
# hard-coded list because the review service is the newest bounded context).
read -r -a databases <<< "${POSTGRES_MULTIPLE_DATABASES:-auth_db,order_db,product_db,payment_db,inventory_db,review_db}"

for database in "${databases[@]}"; do
  # Skip empty entries and the database postgres itself is using for bootstrap.
  [[ -z "$database" ]] && continue
  if [[ "${POSTGRES_DB:-}" != "$database" ]]; then
    printf 'Creating database %s\n' "$database"
    psql --username "$POSTGRES_USER" --dbname "${POSTGRES_DB:-postgres}" --set ON_ERROR_STOP=on \
      --command "CREATE DATABASE \"$database\"" 2>/dev/null || true
  fi
done
