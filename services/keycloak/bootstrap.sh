#!/bin/sh

set -eu

KEYCLOAK_URL="${KEYCLOAK_URL:-http://keycloak:8080}"
KEYCLOAK_REALM="${KEYCLOAK_REALM:-sstore}"
KEYCLOAK_CLIENT_ID="${KEYCLOAK_CLIENT_ID:-sstore-frontend}"
ADMIN_USERNAME="${KC_BOOTSTRAP_ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${KC_BOOTSTRAP_ADMIN_PASSWORD:-admin}"
KEYCLOAK_REALM_DISPLAY_NAME="${KEYCLOAK_REALM_DISPLAY_NAME:-Sstore Realm}"
KEYCLOAK_REGISTRATION_ALLOWED="${KEYCLOAK_REGISTRATION_ALLOWED:-true}"
KEYCLOAK_RESET_PASSWORD_ALLOWED="${KEYCLOAK_RESET_PASSWORD_ALLOWED:-true}"
KEYCLOAK_REMEMBER_ME="${KEYCLOAK_REMEMBER_ME:-true}"
KEYCLOAK_VERIFY_EMAIL="${KEYCLOAK_VERIFY_EMAIL:-false}"
KEYCLOAK_SSL_REQUIRED="${KEYCLOAK_SSL_REQUIRED:-NONE}"
KEYCLOAK_REDIRECT_URIS="${KEYCLOAK_REDIRECT_URIS:-http://localhost,http://localhost/*,http://localhost:5173/*}"
KEYCLOAK_WEB_ORIGINS="${KEYCLOAK_WEB_ORIGINS:-http://localhost,http://localhost:5173}"

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

MASTER_REALM_PAYLOAD="{\"sslRequired\":\"${KEYCLOAK_SSL_REQUIRED}\"}"
curl -fsS -X PUT "${KEYCLOAK_URL}/admin/realms/master" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H 'Content-Type: application/json' \
    -d "$MASTER_REALM_PAYLOAD" >/dev/null

REALM_PAYLOAD="{\"realm\":\"${KEYCLOAK_REALM}\",\"enabled\":true,\"displayName\":\"${KEYCLOAK_REALM_DISPLAY_NAME}\",\"registrationAllowed\":${KEYCLOAK_REGISTRATION_ALLOWED},\"registrationEmailAsUsername\":false,\"resetPasswordAllowed\":${KEYCLOAK_RESET_PASSWORD_ALLOWED},\"rememberMe\":${KEYCLOAK_REMEMBER_ME},\"verifyEmail\":${KEYCLOAK_VERIFY_EMAIL},\"sslRequired\":\"${KEYCLOAK_SSL_REQUIRED}\"}"

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

REDIRECT_URIS_JSON=$(echo "$KEYCLOAK_REDIRECT_URIS" | tr ',' '\n' | sed 's/^/"/; s/$/"/' | tr '\n' ',' | sed 's/,$//')
WEB_ORIGINS_JSON=$(echo "$KEYCLOAK_WEB_ORIGINS" | tr ',' '\n' | sed 's/^/"/; s/$/"/' | tr '\n' ',' | sed 's/,$//')
CLIENT_PAYLOAD="{\"clientId\":\"${KEYCLOAK_CLIENT_ID}\",\"enabled\":true,\"publicClient\":true,\"standardFlowEnabled\":true,\"implicitFlowEnabled\":false,\"redirectUris\":[${REDIRECT_URIS_JSON}],\"webOrigins\":[${WEB_ORIGINS_JSON}]}"
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

curl -fsS -X POST "${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/roles" \
  -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" \
  -d '{"name":"ADMIN"}' >/dev/null || true


# =====================================================================
# STEP 2a: Define Google Identity Provider Variables & Payload
# =====================================================================
IDP_ALIAS="google"

# We safely extract the Client ID and Secret passed from your compose environment
GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-}"
GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-}"

if [ -z "$GOOGLE_CLIENT_ID" ] || [ -z "$GOOGLE_CLIENT_SECRET" ]; then
    printf 'WARNING: Google Identity Provider environment variables are missing. Skipping IdP setup.\n'
else
    IDP_PAYLOAD="{
      \"alias\": \"${IDP_ALIAS}\",
      \"displayName\": \"Google\",
      \"providerId\": \"google\",
      \"enabled\": true,
      \"trustEmail\": true,
      \"storeToken\": false,
      \"addReadTokenRoleOnCreate\": true,
      \"authenticateByDefault\": false,
      \"firstBrokerLoginFlowAlias\": \"first broker login\",
      \"config\": {
        \"clientId\": \"${GOOGLE_CLIENT_ID}\",
        \"clientSecret\": \"${GOOGLE_CLIENT_SECRET}\",
        \"useJwksUrl\": \"true\"
      }
    }"

    # =====================================================================
    # STEP 2b: Send API request to Keycloak to check and update/create
    # =====================================================================
    if curl -fsS -o /dev/null -w '%{http_code}' \
        -H "Authorization: Bearer ${TOKEN}" \
        "${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/identity-provider/instances/${IDP_ALIAS}" | grep -q '^200$'; then
        printf 'Google IdP exists. Updating configuration...\n'
        curl -fsS -X PUT "${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/identity-provider/instances/${IDP_ALIAS}" \
            -H "Authorization: Bearer ${TOKEN}" \
            -H 'Content-Type: application/json' \
            -d "$IDP_PAYLOAD" >/dev/null
    else
        printf 'Creating Google IdP...\n'
        curl -fsS -X POST "${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/identity-provider/instances" \
            -H "Authorization: Bearer ${TOKEN}" \
            -H 'Content-Type: application/json' \
            -d "$IDP_PAYLOAD" >/dev/null
    fi
fi


printf 'Keycloak realm and frontend client are ready.\n'
