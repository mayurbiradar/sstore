#!/bin/sh

set -eu

OUTPUT_FILE=$(mktemp)
if /opt/keycloak/bin/kc.sh bootstrap-admin user \
    --username "$KC_BOOTSTRAP_ADMIN_USERNAME" \
    --password:env=KC_BOOTSTRAP_ADMIN_PASSWORD >"$OUTPUT_FILE" 2>&1; then
    cat "$OUTPUT_FILE"
    rm -f "$OUTPUT_FILE"
    printf 'Keycloak admin user is ready.\n'
else
    cat "$OUTPUT_FILE"
    if grep -q 'user with username exists' "$OUTPUT_FILE"; then
        rm -f "$OUTPUT_FILE"
        printf 'Keycloak admin user already exists; continuing.\n'
    else
        rm -f "$OUTPUT_FILE"
        exit 1
    fi
fi

exec /opt/keycloak/bin/kc.sh start-dev
