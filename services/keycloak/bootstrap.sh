#!/bin/sh

set -eu

KEYCLOAK_URL="${KEYCLOAK_URL:-http://keycloak:8080}"
KEYCLOAK_REALM="${KEYCLOAK_REALM:-sstore}"
KEYCLOAK_CLIENT_ID="${KEYCLOAK_CLIENT_ID:-sstore-frontend}"
ADMIN_USERNAME="${KC_BOOTSTRAP_ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${KC_BOOTSTRAP_ADMIN_PASSWORD:-admin}"

printf 'Waiting for Keycloak...\n'
until curl -fsS "${KEYCLOAK_URL}/realms/master/.well-known/openid-configuration" >/dev/null; do
    sleep 5
done

TOKEN="$(curl -fsS -X POST "${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token" \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    --data-urlencode 'client_id=admin-cli' \
    --data-urlencode "username=${ADMIN_USERNAME}" \
    --data-urlencode "password=${ADMIN_PASSWORD}" \
    --data-urlencode 'grant_type=password' \
    | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')"

if [ -z "$TOKEN" ]; then
    echo 'Unable to obtain the Keycloak admin token.' >&2
    exit 1
fi

REALM_PAYLOAD="{\"realm\":\"${KEYCLOAK_REALM}\",\"enabled\":true,\"displayName\":\"Sstore Realm\",\"registrationAllowed\":true,\"registrationEmailAsUsername\":false,\"resetPasswordAllowed\":true,\"rememberMe\":true,\"verifyEmail\":false}"

if curl -fsS -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer ${TOKEN}" \
    "${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}" | grep -q '^200$'; then
    curl -fsS -X PUT "${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}" \
        -H "Authorization: Bearer ${TOKEN}" \
        -H 'Content-Type: application/json' \
        -d "$REALM_PAYLOAD" >/dev/null
else
    curl -fsS -X POST "${KEYCLOAK_URL}/admin/realms" \
        -H "Authorization: Bearer ${TOKEN}" \
        -H 'Content-Type: application/json' \
        -d "$REALM_PAYLOAD" >/dev/null
fi

CLIENT_PAYLOAD='{"clientId":"sstore-frontend","enabled":true,"publicClient":true,"redirectUris":["http://localhost","http://localhost/*"],"webOrigins":["http://localhost"]}'
CLIENT_ID="$(curl -fsS \
    -H "Authorization: Bearer ${TOKEN}" \
    "${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/clients?clientId=${KEYCLOAK_CLIENT_ID}" \
    | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -n 1)"

if [ -n "$CLIENT_ID" ]; then
    curl -fsS -X PUT "${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/clients/${CLIENT_ID}" \
        -H "Authorization: Bearer ${TOKEN}" \
        -H 'Content-Type: application/json' \
        -d "$CLIENT_PAYLOAD" >/dev/null
else
    curl -fsS -X POST "${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/clients" \
        -H "Authorization: Bearer ${TOKEN}" \
        -H 'Content-Type: application/json' \
        -d "$CLIENT_PAYLOAD" >/dev/null
fi

printf 'Keycloak realm and frontend client are ready.\n'
