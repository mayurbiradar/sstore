# SStore

SStore is a local e-commerce application made up of a React frontend, Spring Boot services, PostgreSQL, and Keycloak.

This repository supports two local workflows:

- Docker Compose for the quickest setup.
- Kubernetes with Kind for a local ingress, TLS, and multi-service deployment.

Run all commands below from the repository root.

## Prerequisites

Install and start Docker Desktop first. It provides the Docker engine required by both workflows.

For Docker Compose:

- Docker Desktop with Docker Compose v2

For Kubernetes:

- Docker Desktop
- `kubectl`
- `kind`
- `curl`
- `mkcert` (the bootstrap script installs it with Homebrew when available)

On macOS, install the Kubernetes tools with:

```bash
brew install kubectl kind curl mkcert
```

## Option 1: Docker Compose

Compose runs the application over HTTP using `localhost`. It builds all application images locally and automatically creates the Keycloak `sstore` realm and `sstore-frontend` client.

Create local configuration and start the stack:

```bash
cp .env.example .env
docker compose up -d --build
```

Open the application:

- Frontend: http://localhost
- API Gateway: http://localhost:9090
- Keycloak: http://localhost:8080

Check service status and logs:

```bash
docker compose ps
docker compose logs -f keycloak-bootstrap
```

Stop the stack:

```bash
docker compose down
```

Use `docker compose down -v` only when you want to delete the local PostgreSQL data volume. PgAdmin is currently disabled in Compose.

## Option 2: Kubernetes with Kind

The Kubernetes workflow creates a local Kind cluster named `sstore`, generates trusted local TLS certificates, installs ingress-nginx, builds and loads the same application images used by Compose, and deploys the stack with Kustomize.

Start the complete development environment:

```bash
./start-dev-cluster.sh
```

The script may ask for your administrator password when it updates `/etc/hosts` or installs the local certificate authority. It adds these local hostnames:

```text
app.sstore.local
api.sstore.local
auth.sstore.local
```

Open the application:

- Frontend: https://app.sstore.local
- API Gateway: https://api.sstore.local
- Keycloak: https://auth.sstore.local

Recreate the cluster from scratch:

```bash
FORCE=true ./start-dev-cluster.sh
```

Delete the local cluster:

```bash
kind delete cluster --name sstore
```

Inspect Kubernetes resources:

```bash
kubectl get pods -n dev
kubectl get svc -n dev
kubectl get ingress -n dev
kubectl get events -n dev --sort-by=.lastTimestamp
```

## Compose and Kubernetes Profiles

The two workflows use the same application image names, service names, ports, database names, and Keycloak realm/client. Their external access URLs differ because Compose publishes ports directly while Kubernetes uses HTTPS ingress.

| Service | Docker Compose | Kubernetes |
| --- | --- | --- |
| Frontend | http://localhost | https://app.sstore.local |
| API Gateway | http://localhost:9090 | https://api.sstore.local |
| Keycloak | http://localhost:8080 | https://auth.sstore.local |
| PostgreSQL | localhost:5432 | Internal Kubernetes service |

Do not use the Kubernetes `*.sstore.local` URLs with the HTTP-only Compose frontend. The Compose frontend uses `localhost` so browser Web Crypto and Keycloak PKCE authentication work correctly.

## Configuration

`.env.example` contains safe local defaults. For Compose overrides:

```bash
cp .env.example .env
```

The frontend configuration is embedded during its image build, so rebuild after changing any `VITE_*` value:

```bash
docker compose up -d --build frontend
```

Do not commit `.env`, passwords, Stripe keys, generated TLS keys, or production secrets.

## Troubleshooting

If Compose tries to pull `sstore/*:dev` images, use:

```bash
docker compose up -d --build
```

The Compose file is configured with `pull_policy: build` so application images are built locally.

If login fails after changing frontend configuration, recreate the frontend and rerun the Keycloak bootstrap:

```bash
docker compose up -d --build frontend keycloak keycloak-bootstrap
```

If Kubernetes bootstrap appears stuck, inspect it with:

```bash
kubectl -n dev get pods
kubectl -n dev describe pod <pod-name>
helm status sstore -n dev
```

The bootstrap checks Keycloak through the `keycloak:8080` Service endpoint.

## Validation Commands

Validate Compose without starting containers:

```bash
docker compose config
```

Render Helm Kubernetes manifests without applying them:

```bash
helm template sstore ./helm/sstore --namespace dev
```

Build the frontend directly:

```bash
cd frontend
npm ci
npm run lint
npm run build
```

## Project Layout

```text
frontend/                         React application, Dockerfile, and Nginx config
services/api-gateway/             API gateway and Dockerfile
services/product-service/         Product service and Dockerfile
services/order-service/           Order service and Dockerfile
services/keycloak/                Compose Keycloak bootstrap script
services/postgres/                PostgreSQL initialization files
k8s/                              Kind, Kustomize, ingress, and infrastructure manifests
helm/sstore/                      Helm chart for Kubernetes deployments
start-dev-cluster.sh              Local Kubernetes bootstrap entry point
docker-compose.yml                Local Docker Compose entry point
docs/                             Architecture, deployment, and development documentation
```

The Kustomize production overlay is retained for reference. The supported Kubernetes deployment path is the Helm chart, with local defaults in `values.yaml` and production guidance in `values-production.example.yaml`.

## Option 3: Kubernetes with Helm

Helm is the deployment path for Kubernetes environments, including production. Docker Compose remains the local development path. The chart deploys PostgreSQL, Keycloak, the Keycloak bootstrap job, all application services, and ingress:

### Local Helm Run

Create a fresh Kind cluster and deploy the complete application with Helm:

```bash
FORCE=true ./start-dev-helm-cluster.sh
```

The script creates the cluster, installs ingress-nginx, generates local TLS certificates, builds and loads application images, and runs `helm upgrade --install`.

### Argo CD GitOps

Argo CD runs in its own `argocd` namespace and manages the SStore Helm release in the `dev` namespace. The Git repository is the source of truth for the application.

#### Prerequisites

Install the local Kubernetes tools and make sure Docker Desktop is running:

```bash
brew install kubectl kind helm mkcert
docker info
```

The installer expects an existing Kind cluster named `sstore`. Create the cluster, ingress controller, TLS certificate, and local SStore images first:

```bash
FORCE=true ./start-dev-helm-cluster.sh
```

The `FORCE=true` option deletes and recreates an existing local cluster. Omit it when the cluster does not already exist. The script adds `app.sstore.local`, `api.sstore.local`, `auth.sstore.local`, and `argocd.sstore.local` to `/etc/hosts`.

#### Install Argo CD

Install Argo CD and register the `sstore-dev` Application:

```bash
./install-argocd.sh
```

The installer uses server-side apply for Argo CD's large CRDs, creates the `argocd` namespace, waits for the Argo CD server, creates its TLS secret, installs the ingress, and applies [k8s/argocd/application-dev.yaml](k8s/argocd/application-dev.yaml). Re-running it is safe and does not require deleting the cluster.

#### Verify Installation

```bash
kubectl get pods -n argocd
kubectl get services -n argocd
kubectl get ingress -n argocd
kubectl get pods -n dev
kubectl -n argocd get application sstore-dev
kubectl -n argocd describe application sstore-dev
```

The expected Application status is `Synced` and `Healthy`.

#### Open the Argo CD UI

The installer configures ingress-nginx and the local TLS certificate. Open `https://argocd.sstore.local` and log in with username `admin`.

On macOS, copy the generated initial password to the clipboard:

```bash
kubectl -n argocd get secret argocd-initial-admin-secret \
	-o jsonpath='{.data.password}' | base64 -D | pbcopy
```

To print the password instead:

```bash
kubectl -n argocd get secret argocd-initial-admin-secret \
	-o jsonpath='{.data.password}' | base64 -D; printf '\n'
```

If ingress is unavailable, use port forwarding:

```bash
kubectl -n argocd port-forward svc/argocd-server 8081:443
```

Then open `https://localhost:8081`.

#### How Deployments Work

The Application tracks the `main` branch and renders `helm/sstore`. Argo CD automatically syncs Git changes, creates the `dev` namespace, prunes resources removed from Git, and repairs manual drift.

Argo CD does not build Docker images. For local Kind, rebuild and load images when application code changes, or run `./start-dev-helm-cluster.sh` for a complete local rebuild:

```bash
docker build -t sstore/api-gateway:dev services/api-gateway
docker build -t sstore/product-service:dev services/product-service
docker build -t sstore/order-service:dev services/order-service
docker build -t sstore/frontend:dev frontend
kind load docker-image sstore/api-gateway:dev --name sstore
kind load docker-image sstore/product-service:dev --name sstore
kind load docker-image sstore/order-service:dev --name sstore
kind load docker-image sstore/frontend:dev --name sstore
kubectl -n dev rollout restart deployment
```

#### Troubleshooting

```bash
kubectl -n argocd get events --sort-by=.lastTimestamp
kubectl -n argocd logs deployment/argocd-server
kubectl -n argocd logs statefulset/argocd-application-controller
kubectl -n argocd describe application sstore-dev
```

If the UI reports invalid credentials, retrieve the current generated password from `argocd-initial-admin-secret`; the default password is not `admin`.

If `argocd.sstore.local` does not resolve:

```bash
echo '127.0.0.1 argocd.sstore.local' | sudo tee -a /etc/hosts
```

If the Application reports image pull errors:

```bash
docker exec sstore-control-plane crictl images | grep sstore
```

#### Remove Argo CD

To remove Argo CD while keeping the Kind cluster:

```bash
kubectl delete -f k8s/argocd/application-dev.yaml --ignore-not-found
kubectl delete -f k8s/argocd/ingress.yaml --ignore-not-found
kubectl delete namespace argocd
```

To remove the entire local environment:

```bash
kind delete cluster --name sstore
```

For later chart or values changes, redeploy without rebuilding the cluster or images:

```bash
./deploy-helm.sh
```

For example, after changing `replicaCount` in `helm/sstore/values.yaml`:

```bash
./deploy-helm.sh
kubectl get deployments -n dev
kubectl get pods -n dev
```

Useful Helm commands:

```bash
helm list -n dev
helm status sstore -n dev
helm get values sstore -n dev
helm get manifest sstore -n dev
helm history sstore -n dev
helm rollback sstore <revision> -n dev
helm uninstall sstore -n dev
```

Preview changes before applying them:

```bash
helm lint ./helm/sstore
helm template sstore ./helm/sstore --namespace dev
helm upgrade sstore ./helm/sstore --namespace dev --dry-run=server --debug
```

Deploy the chart to an existing production cluster with a private values file:

```bash
helm upgrade --install sstore ./helm/sstore \
	--namespace prod --create-namespace \
	-f helm/sstore/values-production.yaml
```

Keep production overrides outside the repository or in a private values file. At minimum, set the application image names/tags, ingress hosts and TLS secret, PostgreSQL and Keycloak credentials, and `services.order-service.stripeSecretKey`. Validate without applying:

Start from the included [values-production.example.yaml](helm/sstore/values-production.example.yaml), but keep the populated copy private.

```bash
helm lint ./helm/sstore
helm template sstore ./helm/sstore --namespace prod -f helm/sstore/values-production.yaml
```
