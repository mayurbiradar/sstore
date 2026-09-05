#!/bin/sh
set -eu

# Connects to $PGHOST:$PGPORT as $PGUSER and creates every database listed in
# $INIT_DATABASES if it does not already exist. Exits 0 when finished.
#
# Used by the Render "sstore-db-init" job to mirror the docker-compose
# POSTGRES_MULTIPLE_DATABASES behavior on Render's free Postgres.

if [ -z "${PGHOST:-}" ] || [ -z "${PGUSER:-}" ] || [ -z "${INIT_DATABASES:-}" ]; then
    echo "Missing required env vars (PGHOST, PGUSER, INIT_DATABASES)" >&2
    exit 1
fi

echo "Waiting for Postgres at ${PGHOST}:${PGPORT:-5432}..."

# Wait until Postgres is reachable
until psql -h "$PGHOST" -p "${PGPORT:-5432}" -U "$PGUSER" -d postgres -c 'SELECT 1' >/dev/null 2>&1; do
    sleep 2
done

echo "Postgres reachable. Ensuring databases exist: $INIT_DATABASES"

# Create each database if missing
for db in $(echo "$INIT_DATABASES" | tr ',' ' '); do
    db="$(echo "$db" | xargs)"  # trim whitespace
    [ -z "$db" ] && continue
    exists=$(psql -h "$PGHOST" -p "${PGPORT:-5432}" -U "$PGUSER" -d postgres -tAc \
        "SELECT 1 FROM pg_database WHERE datname='$db'")
    if [ "$exists" = "1" ]; then
        echo "  - $db already exists, skipping"
    else
        echo "  - creating $db"
        psql -h "$PGHOST" -p "${PGPORT:-5432}" -U "$PGUSER" -d postgres -c "CREATE DATABASE \"$db\""
    fi
done

echo "All databases are ready."
exit 0