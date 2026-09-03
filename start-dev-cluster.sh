#!/usr/bin/env bash

set -euo pipefail

# ============================================================
# Sstore - Local Kubernetes Dev Bootstrap
# Uses Kustomize overlays
# ============================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

CLUSTER_NAME="sstore"
NAMESPACE="dev"

# ------------------------------------------------------------
# Images
# ------------------------------------------------------------

API_GATEWAY_IMAGE="mayurb123/sstore:api-gateway"
PRODUCT_SERVICE_IMAGE="mayurb123/sstore:product-service"
ORDER_SERVICE_IMAGE="mayurb123/sstore:order-service"
FRONTEND_IMAGE="mayurb123/sstore:frontend"

# ------------------------------------------------------------
# URLs
# ------------------------------------------------------------

APP_URL="https://app.sstore.local"
API_URL="https://api.sstore.local"
AUTH_URL="https://auth.sstore.local"

# ------------------------------------------------------------
# Helpers
# ------------------------------------------------------------

log() {
    echo
    echo "============================================================"
    echo "$1"
    echo "============================================================"
}

success() {
    echo "✓ $1"
}

error() {
    echo "✗ $1"
    exit 1
}

# ============================================================
# 1. Check required commands
# ============================================================

log "Checking required tools"

command -v docker >/dev/null 2>&1 || error "Docker is not installed"
command -v kubectl >/dev/null 2>&1 || error "kubectl is not installed"
command -v kind >/dev/null 2>&1 || error "Kind is not installed"
command -v curl >/dev/null 2>&1 || error "curl is not installed"
command -v sudo >/dev/null 2>&1 || error "sudo is not installed"

success "Required tools are available"

# ============================================================
# 2. Check Docker
# ============================================================

log "Checking Docker"

docker info >/dev/null 2>&1 || error "Docker is not running. Start Docker Desktop."

success "Docker is running"

# ============================================================
# 3. Validate project structure
# ============================================================

log "Checking Sstore project structure"

required_paths=(
    "$ROOT_DIR/docker-compose.yml"

    "$ROOT_DIR/k8s/kind/cluster.yaml"

    "$ROOT_DIR/k8s/namespaces/dev.yaml"
    "$ROOT_DIR/k8s/namespaces/prod.yaml"

    "$ROOT_DIR/k8s/infrastructure/postgres"
    "$ROOT_DIR/k8s/infrastructure/keycloak"

    "$ROOT_DIR/k8s/base"
    "$ROOT_DIR/k8s/base/api-gateway"
    "$ROOT_DIR/k8s/base/product-service"
    "$ROOT_DIR/k8s/base/order-service"
    "$ROOT_DIR/k8s/base/frontend"

    "$ROOT_DIR/k8s/overlays/dev"
    "$ROOT_DIR/k8s/overlays/prod"

    "$ROOT_DIR/services/api-gateway"
    "$ROOT_DIR/services/api-gateway/Dockerfile"
    "$ROOT_DIR/services/product-service"
    "$ROOT_DIR/services/product-service/Dockerfile"
    "$ROOT_DIR/services/order-service"
    "$ROOT_DIR/services/order-service/Dockerfile"
    "$ROOT_DIR/frontend"
    "$ROOT_DIR/frontend/Dockerfile"
    "$ROOT_DIR/frontend/nginx.conf"
)

for path in "${required_paths[@]}"; do
    if [[ ! -e "$path" ]]; then
        error "Required path not found: $path"
    fi
done

success "Project structure looks correct"

# ============================================================
# 4. Install mkcert if required
# ============================================================

log "Checking mkcert"

if ! command -v mkcert >/dev/null 2>&1; then

    echo "mkcert is not installed."

    if command -v brew >/dev/null 2>&1; then
        echo "Installing mkcert using Homebrew..."
        brew install mkcert
    elif command -v apt-get >/dev/null 2>&1; then
        echo "Installing mkcert using apt..."
        sudo apt-get update
        sudo apt-get install -y mkcert
    elif command -v dnf >/dev/null 2>&1; then
        echo "Installing mkcert using dnf..."
        sudo dnf install -y mkcert
    elif command -v pacman >/dev/null 2>&1; then
        echo "Installing mkcert using pacman..."
        sudo pacman -S --noconfirm mkcert
    else
        error "Could not automatically install mkcert"
    fi
fi

success "mkcert is available"

# ============================================================
# 5. Install local CA
# ============================================================

log "Installing local CA"

mkcert -install

success "Local CA installed"

# ============================================================
# 6. Generate TLS certificates
# ============================================================

log "Generating local TLS certificates"

TLS_DIR="$ROOT_DIR/k8s/tls"

mkdir -p "$TLS_DIR"

if [[ ! -f "$TLS_DIR/sstore.local.pem" ||
      ! -f "$TLS_DIR/sstore.local-key.pem" ]]; then

    echo "Generating certificates..."

    mkcert \
        -cert-file "$TLS_DIR/sstore.local.pem" \
        -key-file "$TLS_DIR/sstore.local-key.pem" \
        app.sstore.local \
        api.sstore.local \
        auth.sstore.local \
        prometheus.sstore.local \
        grafana.sstore.local \
        jaeger.sstore.local \
        argocd.sstore.local \
        "*.sstore.local"

    success "TLS certificates generated"

else
    success "TLS certificates already exist"
fi

# ============================================================
# 7. Configure /etc/hosts
# ============================================================

log "Configuring /etc/hosts"

HOSTS_ENTRIES=(
    "127.0.0.1 app.sstore.local"
    "127.0.0.1 api.sstore.local"
    "127.0.0.1 auth.sstore.local"
    "127.0.0.1 prometheus.sstore.local"
    "127.0.0.1 grafana.sstore.local"
    "127.0.0.1 jaeger.sstore.local"
    "127.0.0.1 argocd.sstore.local"
)

for entry in "${HOSTS_ENTRIES[@]}"; do

    HOSTNAME=$(echo "$entry" | awk '{print $2}')

    if ! grep -q "[[:space:]]$HOSTNAME$" /etc/hosts; then
        echo "Adding $HOSTNAME"
        echo "$entry" | sudo tee -a /etc/hosts >/dev/null
    else
        echo "$HOSTNAME already exists"
    fi

done

success "/etc/hosts configured"

# ============================================================
# 8. Delete existing Kind cluster
# ============================================================

log "Checking existing Kind cluster"

if kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then

    if [[ "${FORCE:-false}" == "true" ]]; then

        echo "FORCE=true detected."
        echo "Deleting existing cluster..."

        kind delete cluster --name "$CLUSTER_NAME"

    else

        echo
        echo "Kind cluster '$CLUSTER_NAME' already exists."
        echo
        read -r -p "Delete and recreate it? [y/N]: " ANSWER

        if [[ "$ANSWER" =~ ^[Yy]$ ]]; then
            kind delete cluster --name "$CLUSTER_NAME"
        else
            error "Cluster already exists. Use FORCE=true to recreate it."
        fi

    fi
fi

# ============================================================
# 9. Create Kind cluster
# ============================================================

log "Creating Kind cluster"

kind create cluster \
    --name "$CLUSTER_NAME" \
    --config "$ROOT_DIR/k8s/kind/cluster.yaml"

success "Kind cluster created"

kubectl cluster-info --context "kind-$CLUSTER_NAME"

# ============================================================
# 10. Create namespace
# ============================================================

log "Creating dev namespace"

kubectl apply -f "$ROOT_DIR/k8s/namespaces/dev.yaml"

kubectl get namespace "$NAMESPACE"

success "Namespace '$NAMESPACE' is ready"

# ============================================================
# 11. Create TLS secret
# ============================================================

log "Creating TLS secret"

kubectl -n "$NAMESPACE" delete secret sstore-tls \
    --ignore-not-found=true

kubectl -n "$NAMESPACE" create secret tls sstore-tls \
    --cert="$TLS_DIR/sstore.local.pem" \
    --key="$TLS_DIR/sstore.local-key.pem"

success "TLS secret created"

# ============================================================
# 12. Install ingress-nginx
# ============================================================

log "Installing ingress-nginx"

kubectl apply -f \
    https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

success "Ingress-nginx manifests applied"

# ============================================================
# 13. Patch ingress controller for Kind
# ============================================================

log "Configuring ingress controller"

kubectl -n ingress-nginx patch deployment ingress-nginx-controller \
    --type='json' \
    -p='[
        {
            "op": "add",
            "path": "/spec/template/spec/nodeSelector",
            "value": {
                "ingress-ready": "true"
            }
        },
        {
            "op": "add",
            "path": "/spec/template/spec/tolerations",
            "value": [
                {
                    "key": "node-role.kubernetes.io/control-plane",
                    "operator": "Exists",
                    "effect": "NoSchedule"
                }
            ]
        }
    ]' || true

success "Ingress controller configured"

# ============================================================
# 14. Wait for ingress controller
# ============================================================

log "Waiting for ingress controller"

kubectl -n ingress-nginx rollout status \
    deployment/ingress-nginx-controller \
    --timeout=180s

success "Ingress controller is ready"

# ============================================================
# 15. Patch admission webhook
# ============================================================

log "Configuring ingress admission webhook"

kubectl patch validatingwebhookconfiguration ingress-nginx-admission \
    --type='json' \
    -p='[
        {
            "op": "replace",
            "path": "/webhooks/0/failurePolicy",
            "value": "Ignore"
        }
    ]' || true

success "Ingress admission webhook configured"

# ============================================================
# 16. Build application images
# ============================================================

log "Building application images"

echo
echo "Building API Gateway..."
docker build \
    -t "$API_GATEWAY_IMAGE" \
    "$ROOT_DIR/services/api-gateway"

echo
echo "Building Product Service..."
docker build \
    -t "$PRODUCT_SERVICE_IMAGE" \
    "$ROOT_DIR/services/product-service"

echo
echo "Building Order Service..."
docker build \
    -t "$ORDER_SERVICE_IMAGE" \
    "$ROOT_DIR/services/order-service"

echo
echo "Building Frontend..."
docker build \
    -t "$FRONTEND_IMAGE" \
    --build-arg VITE_API_GATEWAY_ENDPOINT="$API_URL" \
    --build-arg VITE_EMAIL="${VITE_EMAIL:-mr.mayurbiradar@gmail.com}" \
    --build-arg VITE_MOBILE="${VITE_MOBILE:-+91 9021901050}" \
    --build-arg VITE_KEYCLOAK_URL="$AUTH_URL" \
    --build-arg VITE_KEYCLOAK_REALM="${VITE_KEYCLOAK_REALM:-sstore}" \
    --build-arg VITE_KEYCLOAK_CLIENT_ID="${VITE_KEYCLOAK_CLIENT_ID:-sstore-frontend}" \
    --build-arg VITE_KEYCLOAK_GOOGLE_IDP_HINT="${VITE_KEYCLOAK_GOOGLE_IDP_HINT:-google}" \
    "$ROOT_DIR/frontend"

success "All application images built"

# ============================================================
# 17. Load images into Kind
# ============================================================

log "Loading images into Kind"

kind load docker-image "$API_GATEWAY_IMAGE" \
    --name "$CLUSTER_NAME"

kind load docker-image "$PRODUCT_SERVICE_IMAGE" \
    --name "$CLUSTER_NAME"

kind load docker-image "$ORDER_SERVICE_IMAGE" \
    --name "$CLUSTER_NAME"

kind load docker-image "$FRONTEND_IMAGE" \
    --name "$CLUSTER_NAME"

success "Images loaded into Kind"

# ============================================================
# 18. Deploy PostgreSQL infrastructure
# ============================================================

log "Deploying PostgreSQL"

kubectl apply \
    -k "$ROOT_DIR/k8s/infrastructure/postgres" \
    -n "$NAMESPACE"

success "PostgreSQL manifests applied"

# ============================================================
# 19. Wait for PostgreSQL
# ============================================================

log "Waiting for PostgreSQL"

kubectl -n "$NAMESPACE" rollout status \
    statefulset/postgres \
    --timeout=180s

kubectl -n "$NAMESPACE" wait \
    --for=condition=ready \
    pod/postgres-0 \
    --timeout=180s

success "PostgreSQL is ready"

# ============================================================
# 20. Deploy Keycloak infrastructure
# ============================================================

log "Deploying Keycloak"

kubectl apply \
    -k "$ROOT_DIR/k8s/infrastructure/keycloak" \
    -n "$NAMESPACE"

success "Keycloak manifests applied"

# ============================================================
# 21. Wait for Keycloak
# ============================================================

log "Waiting for Keycloak"

kubectl -n "$NAMESPACE" rollout status \
    deployment/keycloak \
    --timeout=300s

success "Keycloak deployment is ready"

# ============================================================
# 22. Wait for Keycloak bootstrap
# ============================================================

log "Waiting for Keycloak bootstrap"

if kubectl -n "$NAMESPACE" get job keycloak-bootstrap >/dev/null 2>&1; then

    kubectl -n "$NAMESPACE" wait \
        --for=condition=complete \
        job/keycloak-bootstrap \
        --timeout=300s

    success "Keycloak bootstrap completed"

else
    echo "No keycloak-bootstrap Job found."
    echo "Continuing..."
fi

# ============================================================
# 23. Apply DEV overlay
# ============================================================

log "Deploying Sstore application using DEV overlay"

echo
echo "Kustomize overlay:"
echo "$ROOT_DIR/k8s/overlays/dev"

kubectl apply \
    -k "$ROOT_DIR/k8s/overlays/dev"

success "DEV overlay applied"

# ============================================================
# 24. Show resources
# ============================================================

log "Current Kubernetes resources"

kubectl get pods -n "$NAMESPACE"

echo
kubectl get svc -n "$NAMESPACE"

echo
kubectl get ingress -n "$NAMESPACE"

# ============================================================
# 25. Wait for application deployments
# ============================================================

log "Waiting for application deployments"

kubectl -n "$NAMESPACE" rollout status \
    deployment/product-service \
    --timeout=300s

kubectl -n "$NAMESPACE" rollout status \
    deployment/order-service \
    --timeout=300s

kubectl -n "$NAMESPACE" rollout status \
    deployment/api-gateway \
    --timeout=300s

kubectl -n "$NAMESPACE" rollout status \
    deployment/frontend \
    --timeout=300s

success "All application deployments are ready"

# ============================================================
# 26. Final pod status
# ============================================================

log "Final pod status"

kubectl get pods -n "$NAMESPACE" -o wide

# ============================================================
# 27. Final service status
# ============================================================

log "Final service status"

kubectl get svc -n "$NAMESPACE"

# ============================================================
# 28. Final ingress status
# ============================================================

log "Final ingress status"

kubectl get ingress -n "$NAMESPACE"

# ============================================================
# 29. Test Keycloak
# ============================================================

log "Testing Keycloak"

if curl -k -fsS \
    "$AUTH_URL/realms/sstore/.well-known/openid-configuration" \
    >/dev/null; then

    success "Keycloak endpoint is reachable"

else

    echo "WARNING: Keycloak endpoint is not reachable yet."

fi

# ============================================================
# 30. Test API Gateway
# ============================================================

log "Testing API Gateway"

if curl -k -fsS \
    "$API_URL/api/products" \
    >/dev/null; then

    success "API Gateway is reachable"

else

    echo "WARNING: API endpoint is not reachable yet."
    echo "This may be expected if authentication is required."

fi

# ============================================================
# 31. Test Frontend
# ============================================================

log "Testing Frontend"

if curl -k -fsS \
    "$APP_URL" \
    >/dev/null; then

    success "Frontend is reachable"

else

    echo "WARNING: Frontend is not reachable yet."

fi

# ============================================================
# 32. Finished
# ============================================================

log "Sstore DEV environment is ready"

echo
echo "Application:"
echo "  $APP_URL"

echo
echo "API:"
echo "  $API_URL"

echo
echo "Keycloak:"
echo "  $AUTH_URL"

echo
echo "Namespace:"
echo "  $NAMESPACE"

echo
echo "Cluster:"
echo "  $CLUSTER_NAME"

echo
echo "Useful commands:"
echo
echo "  kubectl get pods -n dev"
echo "  kubectl get svc -n dev"
echo "  kubectl get ingress -n dev"
echo
echo "  kubectl logs -n dev deployment/api-gateway"
echo "  kubectl logs -n dev deployment/product-service"
echo "  kubectl logs -n dev deployment/order-service"
echo
echo "  kubectl describe pod -n dev <pod-name>"
echo
echo "To delete the cluster:"
echo "  kind delete cluster --name sstore"
echo
echo "To recreate everything:"
echo "  FORCE=true ./start-dev-cluster.sh"
echo