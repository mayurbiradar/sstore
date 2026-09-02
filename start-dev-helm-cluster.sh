#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLUSTER_NAME="${CLUSTER_NAME:-sstore}"
NAMESPACE="${NAMESPACE:-dev}"
APP_URL="https://app.sstore.local"
API_URL="https://api.sstore.local"
AUTH_URL="https://auth.sstore.local"
TLS_DIR="$ROOT_DIR/k8s/tls"
SEALED_SECRETS_KEY_BACKUP="$TLS_DIR/sealed-secrets-key-backup.yaml"
CLUSTER_RECREATED=false

error() {
    echo "Error: $1" >&2
    exit 1
}

for command_name in docker kubectl kind helm curl mkcert kubeseal; do
    command -v "$command_name" >/dev/null 2>&1 \
        || error "$command_name is not installed"
done

docker info >/dev/null 2>&1 || error "Docker is not running"

if kind get clusters 2>/dev/null | grep -qx "$CLUSTER_NAME"; then
    if [[ "${FORCE:-false}" == "true" ]]; then
        existing_key_secret="$(kubectl get secret -n kube-system \
            -l sealedsecrets.bitnami.com/sealed-secrets-key \
            -o name 2>/dev/null | head -n 1 || true)"
        if [[ -n "$existing_key_secret" ]]; then
            kubectl get "$existing_key_secret" -n kube-system -o yaml > "$SEALED_SECRETS_KEY_BACKUP"
            chmod 600 "$SEALED_SECRETS_KEY_BACKUP"
        fi
        kind delete cluster --name "$CLUSTER_NAME"
        CLUSTER_RECREATED=true
    else
        error "Kind cluster '$CLUSTER_NAME' already exists. Use FORCE=true to recreate it."
    fi
fi

mkcert -install
mkdir -p "$TLS_DIR"
mkcert \
    -cert-file "$TLS_DIR/sstore.local.pem" \
    -key-file "$TLS_DIR/sstore.local-key.pem" \
    app.sstore.local api.sstore.local auth.sstore.local argocd.sstore.local "*.sstore.local"

for hostname in app.sstore.local api.sstore.local auth.sstore.local argocd.sstore.local; do
    grep -q "[[:space:]]$hostname$" /etc/hosts \
        || echo "127.0.0.1 $hostname" | sudo tee -a /etc/hosts >/dev/null
done

kind create cluster \
    --name "$CLUSTER_NAME" \
    --config "$ROOT_DIR/k8s/kind/cluster.yaml"

kubectl apply -f \
    https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

kubectl -n ingress-nginx patch deployment ingress-nginx-controller \
    --type='json' \
    -p='[{"op":"add","path":"/spec/template/spec/nodeSelector","value":{"ingress-ready":"true"}},{"op":"add","path":"/spec/template/spec/tolerations","value":[{"key":"node-role.kubernetes.io/control-plane","operator":"Exists","effect":"NoSchedule"}]}]' \
    || true

kubectl -n ingress-nginx rollout status deployment/ingress-nginx-controller --timeout=180s

kubectl apply -f \
    https://github.com/bitnami-labs/sealed-secrets/releases/latest/download/controller.yaml

if [[ -s "$SEALED_SECRETS_KEY_BACKUP" ]]; then
    kubectl apply -f "$SEALED_SECRETS_KEY_BACKUP"
fi
kubectl -n kube-system rollout status deployment/sealed-secrets-controller --timeout=180s

SEALED_VALUES_FILE="$ROOT_DIR/helm/sstore/values-sealed.yaml"
if [[ ! -s "$SEALED_VALUES_FILE" || "$CLUSTER_RECREATED" == true || "${RESEAL:-false}" == "true" ]]; then
    SEALED_CERT_FILE="$(mktemp)"
    trap 'rm -f "$SEALED_CERT_FILE"' EXIT
    kubeseal --fetch-cert \
        --controller-name sealed-secrets-controller \
        --controller-namespace kube-system > "$SEALED_CERT_FILE"
    printf '%s\n' \
        "${POSTGRES_USER:-admin}" \
        "${POSTGRES_PASSWORD:-admin}" \
        "${KEYCLOAK_ADMIN:-admin}" \
        "${KEYCLOAK_ADMIN_PASSWORD:-admin}" \
        "${STRIPE_SECRET_KEY:-sk_test_dummy}" \
        | KUBESEAL_BIN=kubeseal CERT_FILE="$SEALED_CERT_FILE" "$ROOT_DIR/seal-helm-values.sh"
fi

kubectl create namespace "$NAMESPACE"
kubectl -n "$NAMESPACE" create secret tls sstore-tls \
    --cert="$TLS_DIR/sstore.local.pem" \
    --key="$TLS_DIR/sstore.local-key.pem"

docker build -t sstore/api-gateway:dev "$ROOT_DIR/services/api-gateway"
docker build -t sstore/product-service:dev "$ROOT_DIR/services/product-service"
docker build -t sstore/order-service:dev "$ROOT_DIR/services/order-service"
docker build \
    -t sstore/frontend:dev \
    --build-arg VITE_API_GATEWAY_ENDPOINT="$API_URL" \
    --build-arg VITE_EMAIL="${VITE_EMAIL:-mr.mayurbiradar@gmail.com}" \
    --build-arg VITE_MOBILE="${VITE_MOBILE:-+91 9021901050}" \
    --build-arg VITE_KEYCLOAK_URL="$AUTH_URL" \
    --build-arg VITE_KEYCLOAK_REALM="${VITE_KEYCLOAK_REALM:-sstore}" \
    --build-arg VITE_KEYCLOAK_CLIENT_ID="${VITE_KEYCLOAK_CLIENT_ID:-sstore-frontend}" \
    --build-arg VITE_KEYCLOAK_GOOGLE_IDP_HINT="${VITE_KEYCLOAK_GOOGLE_IDP_HINT:-google}" \
    "$ROOT_DIR/frontend"

for image in \
    sstore/api-gateway:dev \
    sstore/product-service:dev \
    sstore/order-service:dev \
    sstore/frontend:dev; do
    kind load docker-image "$image" --name "$CLUSTER_NAME"
done

if [[ "${BOOTSTRAP_ONLY:-false}" == "true" ]]; then
    echo "Cluster, ingress, images, and Sealed Secrets controller are ready."
    echo "Encrypted helm/sstore/values-sealed.yaml is ready; run ./deploy-helm.sh."
    exit 0
fi

[[ -s "$SEALED_VALUES_FILE" ]] \
    || error "sealed values not found at $SEALED_VALUES_FILE; run ./seal-helm-values.sh first"

helm upgrade --install sstore "$ROOT_DIR/helm/sstore" \
    --namespace "$NAMESPACE" \
    --create-namespace \
    --wait \
    --timeout 10m \
    --values "$SEALED_VALUES_FILE" \
    "$@"

kubectl get pods,services,ingress -n "$NAMESPACE"
