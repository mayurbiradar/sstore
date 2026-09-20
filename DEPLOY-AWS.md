# AWS EC2 Deployment

This guide deploys SStore on one Ubuntu EC2 instance for learning.

The deployment uses:

- GitHub Actions to build `linux/amd64` Docker images
- Docker Hub to store the images
- One EC2 instance to run Docker Compose
- `sslip.io` hostnames for HTTPS without buying a domain

## 1. AWS resources

Create an Ubuntu EC2 instance and attach an Elastic IP.

Use a sufficiently sized instance for PostgreSQL, Keycloak, Redpanda, four Spring Boot services, and the frontend. A `t3.large` is a reasonable learning starting point.

Configure the EC2 security group:

```text
22    Your IP only
80    0.0.0.0/0
443   0.0.0.0/0
```

Do not expose these publicly:

```text
5432  PostgreSQL
5050  PgAdmin
8082  Product service
8083  Order service
8084  Payment service
9092  Kafka
9644  Redpanda admin
```

Ports `8080` and `9090` are only needed temporarily if accessing Keycloak or the API directly. With Caddy, use ports `80` and `443` instead.

The EC2 public IP used during the original setup was:

```text
52.66.251.122
```

## 2. Install Docker on EC2

Connect from the Mac. Replace the key path if necessary:

```bash
chmod 400 ./sstore.pem
ssh -i ./sstore.pem ubuntu@52.66.251.122
```

Install Docker:

```bash
sudo apt update
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
newgrp docker
```

Verify:

```bash
docker --version
docker compose version
```

## 3. Docker Hub images

The application images are published as:

```text
mayurb123/sstore:api-gateway
mayurb123/sstore:product-service
mayurb123/sstore:order-service
mayurb123/sstore:payment-service
mayurb123/sstore:frontend
```

Images must support the EC2 architecture, normally `linux/amd64`. The Mac used for development is Apple Silicon (`arm64`), so images should be built by the GitHub Actions workflow in:

```text
.github/workflows/publish-images.yml
```

That workflow builds and pushes all five images for `linux/amd64`.

### Docker Hub token

Create a Docker Hub personal access token with `Read & Write` permission for the `mayurb123/sstore` repository.

In the GitHub repository, add these repository secrets:

```text
DOCKERHUB_USERNAME=mayurb123
DOCKERHUB_TOKEN=<Docker Hub personal access token>
```

Do not put the token in `.env` or commit it.

Push the workflow to GitHub:

```bash
git add .github/workflows/publish-images.yml
git commit -m "Publish amd64 Docker images"
git push origin main
```

Run or monitor it from:

```text
GitHub repository -> Actions -> Publish Docker images
```

All five build-and-push steps must succeed before deploying to EC2.

## 4. HTTPS without buying a domain

Normal HTTP on an EC2 IP does not provide Web Crypto, which is required by Keycloak PKCE login. Use these `sslip.io` hostnames:

```text
Frontend: https://store.52-66-251-122.sslip.io
API:      https://api.52-66-251-122.sslip.io
Keycloak: https://auth.52-66-251-122.sslip.io
```

Before starting Caddy, change the `frontend` port mapping in
`docker-compose.aws.yml` from:

```yaml
ports:
  - "80:80"
```

to:

```yaml
ports:
  - "127.0.0.1:8088:80"
```

This leaves host port `80` available for Caddy.

These hostnames resolve to `52.66.251.122`. Keep the Elastic IP; changing it changes the hostnames.

Install Caddy on EC2:

```bash
sudo apt update
sudo apt install -y caddy
```

Create `/etc/caddy/Caddyfile`:

```caddyfile
store.52-66-251-122.sslip.io {
  reverse_proxy 127.0.0.1:8088
}

api.52-66-251-122.sslip.io {
    reverse_proxy 127.0.0.1:9090
}

auth.52-66-251-122.sslip.io {
    reverse_proxy 127.0.0.1:8080
}
```

Start Caddy:

```bash
sudo systemctl enable caddy
sudo systemctl restart caddy
sudo systemctl status caddy
```

Caddy obtains and renews the HTTPS certificates automatically. DNS and ports `80` and `443` must be reachable from the internet.

## 5. Copy deployment files to EC2

The EC2 instance does not need the application source code. It only needs:

```text
docker-compose.aws.yml
.env
services/keycloak/bootstrap.sh
services/postgres/init/init-multiple-databases.sh
```

Create mount directories:

```bash
ssh -i ./sstore.pem ubuntu@52.66.251.122 \
  "mkdir -p /home/ubuntu/services/keycloak /home/ubuntu/services/postgres/init"
```

From the repository root on the Mac, copy the files:

```bash
scp -i ./sstore.pem \
  docker-compose.aws.yml .env \
  ubuntu@52.66.251.122:/home/ubuntu/

scp -i ./sstore.pem \
  services/keycloak/bootstrap.sh \
  ubuntu@52.66.251.122:/home/ubuntu/services/keycloak/bootstrap.sh

scp -i ./sstore.pem \
  services/postgres/init/init-multiple-databases.sh \
  ubuntu@52.66.251.122:/home/ubuntu/services/postgres/init/init-multiple-databases.sh
```

## 6. Configure `.env`

Create or edit `/home/ubuntu/.env` on EC2:

```bash
nano /home/ubuntu/.env
```

For the `sslip.io` HTTPS deployment, use these important values:

```env
POSTGRES_DB=postgres
POSTGRES_USER=admin
POSTGRES_PASSWORD=CHANGE_THIS_PASSWORD

KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=CHANGE_THIS_PASSWORD
KEYCLOAK_HOSTNAME=https://auth.52-66-251-122.sslip.io
KEYCLOAK_URL=http://keycloak:8080
KEYCLOAK_REALM=sstore
KEYCLOAK_ISSUER_URI=https://auth.52-66-251-122.sslip.io/realms/sstore
KEYCLOAK_JWK_SET_URI=http://keycloak:8080/realms/sstore/protocol/openid-connect/certs

PRODUCT_SERVICE_URL=http://product-service:8082
ORDER_SERVICE_URL=http://order-service:8083
PAYMENT_SERVICE_URL=http://payment-service:8084

VITE_API_GATEWAY_ENDPOINT=https://api.52-66-251-122.sslip.io
VITE_KEYCLOAK_URL=https://auth.52-66-251-122.sslip.io
VITE_KEYCLOAK_REALM=sstore
VITE_KEYCLOAK_CLIENT_ID=sstore-frontend
VITE_KEYCLOAK_GOOGLE_IDP_HINT=google

KEYCLOAK_REDIRECT_URIS=https://store.52-66-251-122.sslip.io,https://store.52-66-251-122.sslip.io/*
KEYCLOAK_WEB_ORIGINS=https://store.52-66-251-122.sslip.io

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
RAZORPAY_KEY_ID=test
RAZORPAY_KEY_SECRET=test
RAZORPAY_WEBHOOK_SECRET=test
RAZORPAY_CURRENCY=INR
RAZORPAY_COMPANY_NAME=SStore
```

Keep internal container URLs as Docker service names. Browser-facing `VITE_*` and Keycloak issuer URLs must use the HTTPS `sslip.io` hostnames.

Secure the environment file:

```bash
chmod 600 /home/ubuntu/.env
```

## 7. Start the stack

On EC2:

```bash
cd /home/ubuntu

docker compose -f docker-compose.aws.yml config --quiet
docker compose -f docker-compose.aws.yml pull
docker compose -f docker-compose.aws.yml up -d
docker compose -f docker-compose.aws.yml ps
```

The AWS Compose file pulls prebuilt images and does not build application source code on EC2.

The PostgreSQL and Keycloak scripts are mounted from the files copied in step 5.

## 8. Check startup

Check all services:

```bash
docker compose -f docker-compose.aws.yml ps
```

Check logs:

```bash
docker compose -f docker-compose.aws.yml logs --tail=100 keycloak
docker compose -f docker-compose.aws.yml logs --tail=100 keycloak-bootstrap
docker compose -f docker-compose.aws.yml logs --tail=100 api-gateway
docker compose -f docker-compose.aws.yml logs --tail=100 payment-service
```

`keycloak-bootstrap` is a one-time container. The expected final status is:

```text
Exited (0)
```

The updated bootstrap script configures both the `master` and `sstore` realms with `sslRequired=NONE` by default. This is for the learning HTTP setup and should be changed when using production HTTPS policy.

## 9. Open the application

Frontend:

```text
https://store.52-66-251-122.sslip.io
```

Keycloak admin console:

```text
https://auth.52-66-251-122.sslip.io/admin/master/console/
```

API:

```text
https://api.52-66-251-122.sslip.io
```

Use the values of `KEYCLOAK_ADMIN` and `KEYCLOAK_ADMIN_PASSWORD` from `.env` for the Keycloak admin console.

## 10. Updating the deployment

When code changes:

1. Push the code to GitHub.
2. GitHub Actions rebuilds and pushes the five images.
3. On EC2, pull and recreate the changed services:

```bash
cd /home/ubuntu
docker compose -f docker-compose.aws.yml pull
docker compose -f docker-compose.aws.yml up -d
```

If frontend environment values change, the frontend image must be rebuilt by GitHub Actions because Vite values are embedded during the image build.

If only the Keycloak bootstrap or PostgreSQL init script changes, copy the changed file to EC2 and recreate the relevant container.

## 11. Useful commands

```bash
# Follow all logs
docker compose -f docker-compose.aws.yml logs -f

# Restart one service
docker compose -f docker-compose.aws.yml restart api-gateway

# Recreate Keycloak bootstrap
docker compose -f docker-compose.aws.yml up -d --force-recreate keycloak-bootstrap

# Stop containers without deleting data
docker compose -f docker-compose.aws.yml down
```

Do not run this unless you intentionally want to delete PostgreSQL and PgAdmin data:

```bash
docker compose -f docker-compose.aws.yml down -v
```

## 12. Important learning-project limitations

This setup has:

- One EC2 instance
- Local Docker volumes
- No automatic failover
- HTTP-to-container traffic behind Caddy
- Development-mode Keycloak in the current Compose file
- Manual backup requirements

Change the default passwords, restrict security-group access, and use proper domain-based HTTPS before using real customer or payment data.
