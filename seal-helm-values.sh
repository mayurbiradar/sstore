#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KUBESEAL_BIN="${KUBESEAL_BIN:-$(command -v kubeseal || true)}"
CERT_FILE="${CERT_FILE:-/tmp/sstore-sealed-secrets-cert.pem}"
OUTPUT_FILE="$ROOT_DIR/helm/sstore/values-sealed.yaml"

error() {
    echo "Error: $1" >&2
    exit 1
}

[[ -n "$KUBESEAL_BIN" ]] || error "kubeseal is not in PATH; set KUBESEAL_BIN to its full path"
[[ -f "$CERT_FILE" ]] || error "certificate not found at $CERT_FILE; fetch it with kubeseal --fetch-cert"

read -r -p "PostgreSQL username: " postgres_username
read -r -s -p "PostgreSQL password: " postgres_password
printf '\n'
read -r -p "Keycloak admin username: " keycloak_username
read -r -s -p "Keycloak admin password: " keycloak_password
printf '\n'
read -r -s -p "Stripe secret key (leave empty to disable Stripe): " stripe_secret_key
printf '\n'
read -r -p "Grafana admin username: " grafana_username
read -r -s -p "Grafana admin password: " grafana_password
printf '\n'

seal_value() {
    local value="$1"
    local secret_name="$2"
    "$KUBESEAL_BIN" --raw \
        --from-file=<(printf '%s' "$value") \
        --name "$secret_name" \
        --namespace dev \
        --cert "$CERT_FILE"
}

{
    printf '%s\n' 'secrets:'
    printf '%s\n' '  useSealedSecrets: true'
    printf '%s\n' 'sealedSecrets:'
    printf '%s\n' '  postgres:'
    printf '    POSTGRES_USER: %s\n' "$(seal_value "$postgres_username" postgres-secret)"
    printf '    POSTGRES_PASSWORD: %s\n' "$(seal_value "$postgres_password" postgres-secret)"
    printf '%s\n' '  keycloak:'
    printf '    KC_DB_USERNAME: %s\n' "$(seal_value "$postgres_username" keycloak-secret)"
    printf '    KC_DB_PASSWORD: %s\n' "$(seal_value "$postgres_password" keycloak-secret)"
    printf '    KC_BOOTSTRAP_ADMIN_USERNAME: %s\n' "$(seal_value "$keycloak_username" keycloak-secret)"
    printf '    KC_BOOTSTRAP_ADMIN_PASSWORD: %s\n' "$(seal_value "$keycloak_password" keycloak-secret)"
    printf '%s\n' '  orderService:'
    printf '    STRIPE_SECRET_KEY: %s\n' "$(seal_value "$stripe_secret_key" order-service-secret)"
    printf '%s\n' '  grafana:'
    printf '    GF_SECURITY_ADMIN_USER: %s\n' "$(seal_value "$grafana_username" grafana-admin)"
    printf '    GF_SECURITY_ADMIN_PASSWORD: %s\n' "$(seal_value "$grafana_password" grafana-admin)"
} > "$OUTPUT_FILE"

chmod 600 "$OUTPUT_FILE"
echo "Encrypted values written to $OUTPUT_FILE"
echo "Review the file, commit it, and add it to the Argo CD Application valueFiles."
