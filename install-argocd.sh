#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLUSTER_NAME="${CLUSTER_NAME:-sstore}"
ARGOCD_NAMESPACE="argocd"
ARGOCD_INSTALL_URL="https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml"

error() {
    echo "Error: $1" >&2
    exit 1
}

command -v kubectl >/dev/null 2>&1 || error "kubectl is not installed"
command -v kind >/dev/null 2>&1 || error "Kind is not installed"
command -v sudo >/dev/null 2>&1 || error "sudo is not installed"

kind get clusters 2>/dev/null | grep -qx "$CLUSTER_NAME" \
    || error "Kind cluster '$CLUSTER_NAME' does not exist"

if ! grep -q "[[:space:]]argocd.sstore.local$" /etc/hosts; then
    echo "127.0.0.1 argocd.sstore.local" | sudo tee -a /etc/hosts >/dev/null
fi

kubectl create namespace "$ARGOCD_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
kubectl apply --server-side --force-conflicts \
    --namespace "$ARGOCD_NAMESPACE" \
    -f "$ARGOCD_INSTALL_URL"
kubectl -n "$ARGOCD_NAMESPACE" rollout status deployment/argocd-server --timeout=180s
kubectl -n "$ARGOCD_NAMESPACE" create secret tls argocd-tls \
    --cert="$ROOT_DIR/k8s/tls/sstore.local.pem" \
    --key="$ROOT_DIR/k8s/tls/sstore.local-key.pem" \
    --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f "$ROOT_DIR/k8s/argocd/ingress.yaml"
kubectl apply -f "$ROOT_DIR/k8s/argocd/application-dev.yaml"

echo
echo "Argo CD is installed and the sstore-dev Application is registered."
echo "Watch the application: kubectl -n argocd get application sstore-dev -w"
echo "Open Argo CD locally: https://argocd.sstore.local"
echo "Initial admin password: kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 --decode; echo"