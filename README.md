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

Create the local environment file and start the stack. Docker Compose does not provide fallback values, so `.env` must exist and contain the required settings:

```bash
cp .env.example .env
chmod 600 .env
docker compose up -d --build
```

For local development, `.env.example` uses `admin` for the PostgreSQL and Keycloak username/password values. Replace them before sharing the environment or using it outside your machine. Keep `.env` private; it is ignored by Git.

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

### NetworkPolicy

When NetworkPolicies are enabled, the API gateway, product service, and order service must be allowed to reach Keycloak on TCP port `8080`. Keycloak must allow ingress from those services so they can validate JWTs and access the Keycloak admin API.

Inspect the active policy and verify the Keycloak endpoint:

```bash
kubectl get networkpolicy keycloak-traffic -n dev -o yaml
kubectl get endpoints keycloak -n dev
```

If `/api/users/count` returns `500`, check the API gateway logs for a timeout while fetching Keycloak signing keys:

```bash
kubectl logs -n dev deploy/api-gateway | grep -E 'JwtException|Connect timed out'
```

The Helm chart defines these rules in `helm/sstore/templates/networkpolicy.yaml`. Reapply the release after changing them:

```bash
helm upgrade sstore ./helm/sstore --namespace dev --values ./helm/sstore/values-sealed.yaml --wait
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

`.env.example` contains the complete Docker Compose configuration. Copy it to `.env` for local development, then edit `.env` for local overrides:

```bash
cp .env.example .env
chmod 600 .env
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

Helm is the deployment path for Kubernetes environments, including production. Docker Compose remains the local development path. The chart deploys PostgreSQL, Keycloak, the Keycloak bootstrap job, all application services, Prometheus, Grafana, and ingress:

Monitoring is enabled by default. Prometheus scrapes the API gateway, product service, and order service Actuator metrics, while Grafana is provisioned with Prometheus as its default data source. Open `https://prometheus.sstore.local` or `https://grafana.sstore.local`. The local Grafana login defaults to `admin` / `admin`; change it for shared environments.

In Grafana, the Prometheus data source URL is the internal Kubernetes service URL:

```text
http://prometheus:9090
```

Do not use `https://prometheus.sstore.local/` as the Grafana data source URL. That hostname is for opening Prometheus in a browser through ingress; Grafana accesses Prometheus inside the cluster over HTTP. The Helm chart provisions this data source automatically.

### Local Helm Run

Create a fresh Kind cluster and deploy the complete application with Helm:

```bash
FORCE=true ./start-dev-helm-cluster.sh
```

The script creates the cluster, installs ingress-nginx and Sealed Secrets, generates local TLS certificates, builds and loads application images, creates encrypted local-development values when `helm/sstore/values-sealed.yaml` is missing, and runs `helm upgrade --install`. Existing encrypted values are preserved.

#### Fresh Clone Without the Shared Sealed Secrets Key

The encrypted `values-sealed.yaml` file can only be decrypted by the Sealed Secrets private key that encrypted it. For a local-only cluster, initialize the cluster first, generate new encrypted values, and deploy with Helm:

```bash
BOOTSTRAP_ONLY=true ./start-dev-helm-cluster.sh
./deploy-helm.sh
```

The bootstrap script automatically fetches the controller certificate and creates encrypted local-development values using `POSTGRES_USER`, `POSTGRES_PASSWORD`, `KEYCLOAK_ADMIN`, `KEYCLOAK_ADMIN_PASSWORD`, `STRIPE_SECRET_KEY`, `GRAFANA_ADMIN_USER`, and `GRAFANA_ADMIN_PASSWORD` from the environment. If unset, it uses local-only dummy values (`admin` and `sk_test_dummy`); Grafana defaults to `admin` / `admin`. Set those variables before running the script when different values are required.

If using Argo CD, push the newly generated encrypted `helm/sstore/values-sealed.yaml` to the repository before running `./install-argocd.sh`. Never share or commit `k8s/tls/sealed-secrets-key-backup.yaml`; transfer that private backup securely when a developer must use the repository's existing encrypted values.

### Argo CD GitOps

Argo CD runs in its own `argocd` namespace and manages the SStore Helm release in the `dev` namespace. The Git repository is the source of truth for the application.

#### Prerequisites

Install the local Kubernetes tools and make sure Docker Desktop is running:

```bash
brew install kubectl kind helm kubeseal mkcert
docker info
```

The installer expects an existing Kind cluster named `sstore`. Create the cluster, ingress controller, TLS certificate, and local SStore images first:

```bash
FORCE=true ./start-dev-helm-cluster.sh
```

The `FORCE=true` option deletes and recreates an existing local cluster. Omit it when the cluster does not already exist. The script adds `app.sstore.local`, `api.sstore.local`, `auth.sstore.local`, and `argocd.sstore.local` to `/etc/hosts`.

When recreating the cluster, the Helm bootstrap backs up and restores the Sealed Secrets controller key in `k8s/tls/sealed-secrets-key-backup.yaml`. This local backup is ignored by Git and must be protected; without it, existing encrypted values must be re-encrypted for the new cluster.

The Helm bootstrap installs the free, open-source Sealed Secrets controller in the `kube-system` namespace. The controller decrypts `SealedSecret` resources inside Kubernetes and creates the corresponding Secrets. The private decryption key stays in the cluster; only encrypted values should be committed to Git.

To enable sealed secrets, first fetch the controller certificate after the cluster is running:

```bash
kubeseal --fetch-cert \
	--controller-name sealed-secrets-controller \
	--controller-namespace kube-system > /tmp/sstore-sealed-secrets-cert.pem
```

Run the helper below and enter the values at its hidden prompts. It writes only encrypted values to `helm/sstore/values-sealed.yaml`:

```bash
KUBESEAL_BIN="$(brew --prefix kubeseal)/bin/kubeseal" ./seal-helm-values.sh
```

The generated file must contain:

```yaml
secrets:
	useSealedSecrets: true
sealedSecrets:
	postgres:
		POSTGRES_USER: <encrypted-value>
		POSTGRES_PASSWORD: <encrypted-value>
	keycloak:
		KC_DB_USERNAME: <encrypted-value>
		KC_DB_PASSWORD: <encrypted-value>
		KC_BOOTSTRAP_ADMIN_USERNAME: <encrypted-value>
		KC_BOOTSTRAP_ADMIN_PASSWORD: <encrypted-value>
	orderService:
		STRIPE_SECRET_KEY: <encrypted-value>
	grafana:
		GF_SECURITY_ADMIN_USER: <encrypted-value>
		GF_SECURITY_ADMIN_PASSWORD: <encrypted-value>
```

The helper uses `kubeseal --raw` and does not write plaintext values to disk. To encrypt an individual value manually without writing its plaintext to disk:

```bash
kubeseal --raw \
	--from-file=<(printf %s "$POSTGRES_PASSWORD") \
	--name postgres-secret --namespace dev \
	--cert /tmp/sstore-sealed-secrets-cert.pem
```

Commit only the encrypted values file, never the plaintext values. The Argo CD Application already loads it through `spec.source.helm.valueFiles` in [k8s/argocd/application-dev.yaml](k8s/argocd/application-dev.yaml). Argo CD renders the `SealedSecret` resources and the controller creates the Secrets.

The Grafana and Prometheus Services are internal `ClusterIP` Services and are also available through the local TLS ingress. To access them without ingress, use port forwarding:

```bash
kubectl -n dev port-forward svc/grafana 3000:3000
kubectl -n dev port-forward svc/prometheus 9090:9090
```

The monitoring NetworkPolicies allow ingress-nginx to reach both UIs, Grafana to query Prometheus, and Prometheus to scrape the three Spring Boot Actuator endpoints.

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

Argo CD is a Kubernetes continuous delivery (CD) and GitOps tool, not a continuous integration (CI) tool. It does not build Docker images, run tests, or publish images. CI tools such as GitHub Actions, GitLab CI, Jenkins, or Tekton handle those tasks. A typical workflow is:

```text
Code commit -> CI builds and tests -> CI publishes an image -> Git manifest or Helm values change -> Argo CD syncs Kubernetes
```

Helm is not required by Argo CD itself. Argo CD can deploy plain Kubernetes YAML, Kustomize, Jsonnet, or Helm charts. This repository uses Helm as Argo CD's manifest source at `helm/sstore`, so Helm chart and values changes should be committed and pushed to Git for Argo CD to deploy. For local Kind, rebuild and load images when application code changes, or run `./start-dev-helm-cluster.sh` for a complete local rebuild:

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

#### Network Policies

NetworkPolicies are enabled for both development and production. They keep the internal services private and allow only the required traffic:

```text
Ingress -> frontend
Ingress -> api-gateway -> product-service -> postgres
					 -> order-service   -> postgres
Ingress -> keycloak  -> postgres
```

The frontend, API gateway, and Keycloak accept traffic from the `ingress-nginx` namespace. Product service and order service accept traffic only from the API gateway. PostgreSQL accepts traffic only from product service, order service, and Keycloak. DNS traffic to the cluster DNS pods is also allowed.

The policies are defined in [helm/sstore/templates/networkpolicy.yaml](helm/sstore/templates/networkpolicy.yaml) and configured with `networkPolicy.enabled` and `networkPolicy.ingressNamespace` in the values files. Apply them locally with:

```bash
./deploy-helm.sh
kubectl get networkpolicies -n dev
```

When using a different ingress controller namespace, update `networkPolicy.ingressNamespace`. The Kubernetes network plugin must support NetworkPolicy enforcement; the default Kind networking setup may accept the resources without enforcing them.

##### Drawbacks When NetworkPolicies Are Disabled

When `networkPolicy.enabled` is `false`, Kubernetes does not restrict pod-to-pod traffic in the namespace. Any pod that can run in the namespace may be able to connect directly to product service, order service, Keycloak, or PostgreSQL through their internal Kubernetes Services.

Application authentication still protects HTTP endpoints, but it does not prevent network connections or port scanning. A compromised pod could therefore reach internal services directly, bypass the API gateway's intended routing and controls, or attempt attacks against databases and other service ports. Keep policies enabled in production and use an enforcing CNI.

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

For Helm-only environments, later chart or values changes can be deployed without rebuilding the cluster or images:

```bash
./deploy-helm.sh
```

When Argo CD manages the release, commit and push chart or values changes instead. Do not run `./deploy-helm.sh` against the same namespace, because Argo CD-created resources do not have Helm release ownership metadata:

```bash
git add helm/sstore
git commit -m "update Helm deployment"
git push origin main
kubectl get application sstore-dev -n argocd
```

For example, after changing a service's `replicas` value in `helm/sstore/values.yaml`:

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
