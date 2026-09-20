#!/usr/bin/env bash

set -Eeuo pipefail

KEY_FILE="${KEY_FILE:-./sstore.pem}"
EC2_USER="${EC2_USER:-ubuntu}"
AWS_PUBLIC_IP="${AWS_PUBLIC_IP:-52.66.251.122}"
EC2_HOST="${EC2_HOST:-$AWS_PUBLIC_IP}"
REMOTE_DIR="${REMOTE_DIR:-/home/ubuntu}"
SSH_TARGET="${EC2_USER}@${EC2_HOST}"
AWS_HOSTNAME="${AWS_HOSTNAME:-$(printf '%s' "$EC2_HOST" | tr '.' '-')}.sslip.io"

FRONTEND_HOST="store.${AWS_HOSTNAME}"
API_HOST="api.${AWS_HOSTNAME}"
AUTH_HOST="auth.${AWS_HOSTNAME}"

require_file() {
    [[ -f "$1" ]] || { echo "Missing required file: $1" >&2; exit 1; }
}

require_file "$KEY_FILE"
require_file .env.aws
require_file docker-compose.aws.yml
require_file services/keycloak/bootstrap.sh
require_file services/postgres/init/init-multiple-databases.sh

chmod 400 "$KEY_FILE"

ssh -i "$KEY_FILE" "$SSH_TARGET" \
    "mkdir -p '${REMOTE_DIR}/services/keycloak' '${REMOTE_DIR}/services/postgres/init'"

scp -i "$KEY_FILE" .env.aws docker-compose.aws.yml \
    "${SSH_TARGET}:${REMOTE_DIR}/"
scp -i "$KEY_FILE" services/keycloak/bootstrap.sh \
    "${SSH_TARGET}:${REMOTE_DIR}/services/keycloak/"
scp -i "$KEY_FILE" services/postgres/init/init-multiple-databases.sh \
    "${SSH_TARGET}:${REMOTE_DIR}/services/postgres/init/"

ssh -i "$KEY_FILE" "$SSH_TARGET" "bash -s" <<REMOTE_SCRIPT
set -Eeuo pipefail
cd '${REMOTE_DIR}'

mv .env.aws .env
chmod 600 .env

if ! command -v docker >/dev/null 2>&1; then
    curl -fsSL https://get.docker.com | sudo sh
    sudo systemctl enable --now docker
fi

if ! command -v caddy >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
    sudo apt-get update
    sudo apt-get install -y caddy
fi

DOCKER=(docker)
if ! docker info >/dev/null 2>&1; then DOCKER=(sudo docker); fi

"\${DOCKER[@]}" compose --env-file .env -f docker-compose.aws.yml stop frontend >/dev/null 2>&1 || true

sudo tee /etc/caddy/Caddyfile >/dev/null <<CADDYFILE
${FRONTEND_HOST} {
    reverse_proxy 127.0.0.1:8088
}

${API_HOST} {
    reverse_proxy 127.0.0.1:9090
}

${AUTH_HOST} {
    reverse_proxy 127.0.0.1:8080
}
CADDYFILE

sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl enable --now caddy
sudo systemctl reload caddy

"\${DOCKER[@]}" compose --env-file .env -f docker-compose.aws.yml config --quiet
"\${DOCKER[@]}" compose --env-file .env -f docker-compose.aws.yml pull
"\${DOCKER[@]}" compose --env-file .env -f docker-compose.aws.yml up -d
"\${DOCKER[@]}" compose --env-file .env -f docker-compose.aws.yml up -d --force-recreate keycloak-bootstrap
"\${DOCKER[@]}" compose --env-file .env -f docker-compose.aws.yml ps

echo
echo "Frontend: https://${FRONTEND_HOST}"
echo "API:      https://${API_HOST}"
echo "Keycloak: https://${AUTH_HOST}/admin/master/console/"
REMOTE_SCRIPT
