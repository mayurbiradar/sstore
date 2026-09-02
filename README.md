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

The Kubernetes workflow creates a local Kind cluster named `sstore`, generates trusted local TLS certificates, installs ingress-nginx, builds and loads the same application images used by Compose, deploys PostgreSQL and Keycloak, creates the Keycloak realm/client, and applies `k8s/overlays/dev`.

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
kubectl logs -n dev job/keycloak-bootstrap
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
kubectl -n dev get job keycloak-bootstrap
kubectl -n dev logs job/keycloak-bootstrap
```

The bootstrap checks Keycloak through the `keycloak:8080` Service endpoint.

## Validation Commands

Validate Compose without starting containers:

```bash
docker compose config
```

Render Kubernetes manifests without applying them:

```bash
kubectl kustomize k8s/overlays/dev
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
start-dev-cluster.sh              Local Kubernetes bootstrap entry point
docker-compose.yml                Local Docker Compose entry point
docs/                             Architecture, deployment, and development documentation
```

The Kubernetes production overlay is not a production deployment configuration yet. The supported ready-to-run Kubernetes path is the local `dev` overlay.
