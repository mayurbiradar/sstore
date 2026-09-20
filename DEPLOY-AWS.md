# AWS EC2 Deployment

This guide deploys SStore on one Ubuntu EC2 instance for learning.

The deployment uses GitHub Actions for `linux/amd64` images, Docker Hub for image storage, Docker Compose on EC2, and Caddy with `sslip.io` for HTTPS without buying a domain.

## Architecture

```text
Browser
  |
  | HTTPS
  v
Caddy on EC2
  |-- store.<AWS_HOSTNAME> -> frontend container on 127.0.0.1:8088
  |-- api.<AWS_HOSTNAME>   -> api-gateway on 127.0.0.1:9090
  |-- auth.<AWS_HOSTNAME>  -> Keycloak on 127.0.0.1:8080
  |
  `-- private Docker network
      PostgreSQL, Redpanda, product-service, order-service, payment-service
```

The EC2 instance does not need the application source code. It only pulls published images and receives the deployment files copied by `deploy-aws.sh`.

## 1. AWS resources

Create an Ubuntu EC2 instance and attach an Elastic IP. Keeping the Elastic IP means the public hostname does not change when the instance is replaced.

A `t3.large` is a reasonable learning starting point for PostgreSQL, Keycloak, Redpanda, four Spring Boot services, and the frontend.

Configure the EC2 security group:

```text
22    Your IP only
80    0.0.0.0/0
443   0.0.0.0/0
```

Do not expose these publicly:

```text
5050  PgAdmin
5432  PostgreSQL
8082  Product service
8083  Order service
8084  Payment service
9092  Kafka
9644  Redpanda admin
```

Ports `8080` and `9090` are only internal host bindings for Caddy. They do not need public security-group rules.

## 2. Central AWS host configuration

The current Elastic IP is `52.66.251.122`. The AWS environment file contains the central values:

```env
AWS_PUBLIC_IP=52.66.251.122
AWS_HOSTNAME=52-66-251-122.sslip.io
```

The public URLs are derived from `AWS_HOSTNAME`:

```text
Frontend: https://store.52-66-251-122.sslip.io
API:      https://api.52-66-251-122.sslip.io
Keycloak: https://auth.52-66-251-122.sslip.io
```

If the Elastic IP changes, update `AWS_PUBLIC_IP` and `AWS_HOSTNAME` in `.env.aws`, and update the GitHub repository variable `AWS_HOSTNAME`. Do not add `https://` to the variable value.

## 3. GitHub Actions and Docker Hub

The workflow at `.github/workflows/publish-images.yml` builds and pushes these images for `linux/amd64`:

```text
mayurb123/sstore:api-gateway
mayurb123/sstore:product-service
mayurb123/sstore:order-service
mayurb123/sstore:payment-service
mayurb123/sstore:frontend
```

This is required because an Apple Silicon Mac builds `arm64` images by default, while the usual EC2 instance uses `amd64`.

Add these GitHub repository secrets under **Settings -> Secrets and variables -> Actions**:

```text
DOCKERHUB_USERNAME=mayurb123
DOCKERHUB_TOKEN=<Docker Hub personal access token with Read & Write permission>
```

Add this GitHub repository variable under **Settings -> Secrets and variables -> Actions -> Variables**:

```text
AWS_HOSTNAME=52-66-251-122.sslip.io
```

The workflow has the same hostname as a fallback, but configuring the repository variable is recommended.

Push workflow changes:

```bash
git add .github/workflows/publish-images.yml
git commit -m "Update AWS image workflow"
git push origin main
```

Then open **Actions -> Publish Docker images** and wait for all five image steps to succeed.

## 4. Local deployment files

From the repository root, these files are used by the one-command deployment:

```text
sstore.pem                          SSH key, private and ignored
.env.aws                            private AWS credentials, ignored
.env.aws.example                    safe AWS environment template
docker-compose.aws.yml              AWS Compose definition
deploy-aws.sh                       copy and deploy script
services/keycloak/bootstrap.sh      Keycloak realm/client bootstrap
services/postgres/init/init-multiple-databases.sh
```

The private `.env.aws` must contain your Google and Razorpay credentials. Never commit it or print its values.

## 5. One-command deployment

From the repository root on your Mac:

```bash
chmod 400 sstore.pem
chmod +x deploy-aws.sh
./deploy-aws.sh
```

The script automatically:

1. Connects to EC2 over SSH.
2. Creates the required remote directories.
3. Copies `.env.aws` as `/home/ubuntu/.env`.
4. Copies `docker-compose.aws.yml` and both bootstrap scripts.
5. Installs Docker if it is missing.
6. Installs Caddy if it is missing.
7. Stops the previous frontend so Caddy can use ports 80 and 443.
8. Writes the Caddy reverse-proxy configuration.
9. Validates Compose.
10. Pulls the published images.
11. Starts the stack and recreates `keycloak-bootstrap`.
12. Prints the final HTTPS URLs.

The script uses `AWS_PUBLIC_IP`/`AWS_HOSTNAME` from the local environment when supplied. It defaults to the current EC2 IP for this learning deployment.

## 6. AWS environment values

`.env.aws` is private and is copied automatically. Its important values are:

```env
AWS_PUBLIC_IP=52.66.251.122
AWS_HOSTNAME=52-66-251-122.sslip.io

POSTGRES_DB=postgres
POSTGRES_USER=admin
POSTGRES_PASSWORD=admin

KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=admin
KEYCLOAK_HOSTNAME=https://auth.${AWS_HOSTNAME}
KEYCLOAK_URL=http://keycloak:8080
KEYCLOAK_REALM=sstore
KEYCLOAK_ISSUER_URI=https://auth.${AWS_HOSTNAME}/realms/sstore
KEYCLOAK_JWK_SET_URI=http://keycloak:8080/realms/sstore/protocol/openid-connect/certs
KEYCLOAK_SSL_REQUIRED=EXTERNAL

PRODUCT_SERVICE_URL=http://product-service:8082
ORDER_SERVICE_URL=http://order-service:8083
PAYMENT_SERVICE_URL=http://payment-service:8084
CORS_ALLOWED_ORIGINS=https://store.${AWS_HOSTNAME}

KEYCLOAK_REDIRECT_URIS=https://store.${AWS_HOSTNAME},https://store.${AWS_HOSTNAME}/*
KEYCLOAK_WEB_ORIGINS=https://store.${AWS_HOSTNAME}

VITE_API_GATEWAY_ENDPOINT=https://api.${AWS_HOSTNAME}
VITE_KEYCLOAK_URL=https://auth.${AWS_HOSTNAME}
VITE_KEYCLOAK_REALM=sstore
VITE_KEYCLOAK_CLIENT_ID=sstore-frontend
```

The Google and Razorpay values are copied from the private file. Replace the demo `admin` passwords before using real data.

## 7. HTTPS and authentication

Caddy automatically obtains and renews certificates for the three `sslip.io` hostnames. HTTPS is required for browser Web Crypto and Keycloak PKCE.

The frontend uses standard authorization-code flow with PKCE. Implicit flow is disabled in the Keycloak client. Google OAuth redirect URI:

```text
https://auth.52-66-251-122.sslip.io/realms/sstore/broker/google/endpoint
```

Add that exact URI to the Google OAuth client in Google Cloud Console.

Keycloak runs HTTP inside Docker and receives the public HTTPS hostname through:

```yaml
KC_HTTP_ENABLED: "true"
KC_PROXY_HEADERS: xforwarded
KC_HOSTNAME: ${KEYCLOAK_HOSTNAME}
```

The bootstrap script configures both the `master` and `sstore` realms and updates the frontend client idempotently. It uses `KEYCLOAK_SSL_REQUIRED=EXTERNAL` for AWS HTTPS.

## 8. Verify the deployment

Open:

```text
Frontend: https://store.52-66-251-122.sslip.io
Keycloak: https://auth.52-66-251-122.sslip.io/admin/master/console/
API:      https://api.52-66-251-122.sslip.io
```

On EC2:

```bash
cd /home/ubuntu
docker compose -f docker-compose.aws.yml ps
```

The expected state is:

- PostgreSQL: `Up (healthy)`
- Redpanda: `Up (healthy)`
- Application services: `Up`
- `keycloak-bootstrap`: `Exited (0)`

Check logs:

```bash
docker compose -f docker-compose.aws.yml logs --tail=100 keycloak-bootstrap
docker compose -f docker-compose.aws.yml logs --tail=100 api-gateway
docker compose -f docker-compose.aws.yml logs --tail=100 order-service
docker compose -f docker-compose.aws.yml logs --tail=100 payment-service
```

## 9. Payment flow troubleshooting

Order creation and payment-session creation are separate requests. If order creation succeeds but payment-session returns `503`, check that order-service received the Docker payment URL:

```bash
docker inspect order-service \
  --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | grep PAYMENT_SERVICE_URL
```

Expected:

```text
PAYMENT_SERVICE_URL=http://payment-service:8084
```

Check payment credentials without printing them:

```bash
docker exec payment-service sh -c '
for variable in RAZORPAY_KEY_ID RAZORPAY_KEY_SECRET RAZORPAY_WEBHOOK_SECRET; do
  value=$(printenv "$variable" || true)
  printf "%s length=%s\\n" "$variable" "${#value}"
done
'
```

A healthy payment service only proves that the process and database are running; it does not prove that Razorpay credentials are valid.

## 10. OpenTelemetry

The Java images include the OpenTelemetry agent, but this learning Compose profile does not deploy an OpenTelemetry collector. Therefore the four Java services set:

```yaml
OTEL_SDK_DISABLED: "true"
```

This prevents repeated connection attempts to `localhost:4318`. Enable telemetry only after deploying a collector and configuring its endpoint.

## 11. Updates and data safety

After code changes:

1. Push to `main`.
2. Wait for GitHub Actions to publish all five images.
3. Run from the repository root:

```bash
./deploy-aws.sh
```

Do not run:

```bash
docker compose -f docker-compose.aws.yml down -v
```

That deletes PostgreSQL and PgAdmin volumes. Use EBS snapshots and database backups for anything important.

## 12. Important limitations

This is a learning deployment with one EC2 instance, local Docker volumes, no automatic failover, development-mode Keycloak, and manual backups. Keep the security group restricted and replace demo passwords before handling real users, orders, or payments.
