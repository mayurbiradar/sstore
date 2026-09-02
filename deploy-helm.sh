#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLUSTER_NAME="${CLUSTER_NAME:-sstore}"
NAMESPACE="${NAMESPACE:-dev}"
RELEASE_NAME="${RELEASE_NAME:-sstore}"
CHART_DIR="$ROOT_DIR/helm/sstore"
TLS_DIR="$ROOT_DIR/k8s/tls"

error() {
    echo "Error: $1" >&2
    exit 1
}

command -v helm >/dev/null 2>&1 || error "Helm is not installed"
command -v kubectl >/dev/null 2>&1 || error "kubectl is not installed"
command -v kind >/dev/null 2>&1 || error "Kind is not installed"

kind get clusters 2>/dev/null | grep -qx "$CLUSTER_NAME" \
    || error "Kind cluster '$CLUSTER_NAME' does not exist. Run ./start-dev-cluster.sh first."

test -f "$CHART_DIR/Chart.yaml" \
    || error "Helm chart not found at $CHART_DIR"

SEALED_VALUES_FILE="$CHART_DIR/values-sealed.yaml"
[[ -s "$SEALED_VALUES_FILE" ]] \
    || error "sealed values not found at $SEALED_VALUES_FILE; run ./seal-helm-values.sh first"

kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

if [[ -f "$TLS_DIR/sstore.local.pem" && -f "$TLS_DIR/sstore.local-key.pem" ]]; then
    kubectl -n "$NAMESPACE" create secret tls sstore-tls \
        --cert="$TLS_DIR/sstore.local.pem" \
        --key="$TLS_DIR/sstore.local-key.pem" \
        --dry-run=client -o yaml | kubectl apply -f -
fi

helm upgrade --install "$RELEASE_NAME" "$CHART_DIR" \
    --namespace "$NAMESPACE" \
    --create-namespace \
    --wait \
    --timeout 10m \
    --values "$SEALED_VALUES_FILE" \
    "$@"

echo
echo "Helm release '$RELEASE_NAME' deployed in namespace '$NAMESPACE'."
kubectl get pods,services,ingress -n "$NAMESPACE"
