#!/usr/bin/env bash
# Instala Docker no Ubuntu (VM Oracle Always Free) e sobe a API MadePinus.
# Uso (já na pasta do repositório, como utilizador ubuntu):
#   chmod +x scripts/preparar-vm-ubuntu.sh
#   ./scripts/preparar-vm-ubuntu.sh
set -euo pipefail

if [[ "$(id -u)" -eq 0 ]]; then
  echo "Corra este script como ubuntu (sem sudo). Ele pede sudo quando precisa."
  exit 1
fi

raiz="$(cd "$(dirname "$0")/.." && pwd)"
cd "$raiz"

if ! command -v docker >/dev/null 2>&1; then
  echo "A instalar Docker..."
  sudo apt-get update
  sudo apt-get install -y ca-certificates curl git
  sudo install -m 0755 -d /etc/apt/keyrings
  sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  sudo chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${VERSION_CODENAME}") stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  sudo usermod -aG docker "$USER"
  echo
  echo "Docker instalado. Saia do SSH, volte a entrar e rode de novo:"
  echo "  cd $raiz && ./scripts/preparar-vm-ubuntu.sh"
  exit 0
fi

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Criei .env a partir do exemplo. Edite JWT_SECRET e ADMIN_SENHA antes de continuar:"
  echo "  nano $raiz/.env"
  exit 1
fi

if grep -q 'gere-com-node-e-crypto-randomBytes-48-hex' .env || grep -q 'troque-este-acesso' .env; then
  echo "Ainda há valores de exemplo no .env (JWT_SECRET ou ADMIN_SENHA). Edite e rode de novo."
  exit 1
fi

docker compose up -d --build
echo
echo "API a subir. Teste: curl -s http://127.0.0.1:4000/saude"
echo "Túnel Cloudflare (depois de TUNNEL_TOKEN no .env): docker compose --profile tunel up -d"
echo "Guia completo: docs/api-oracle-cloud.md"
