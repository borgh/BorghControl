#!/bin/bash
set -e

echo "=== BorghControl Deploy ==="
echo "Iniciando deploy em: $(date)"

# Diretório do projeto no servidor
PROJECT_DIR="/var/www/borghcontrol"
REPO_DIR="$PROJECT_DIR/repo"

# Criar diretório do repo se não existir
mkdir -p "$REPO_DIR"

# Clonar ou atualizar o repositório
if [ -d "$REPO_DIR/.git" ]; then
  echo ">>> Atualizando código do GitHub..."
  cd "$REPO_DIR"
  git fetch origin
  git reset --hard origin/main
else
  echo ">>> Clonando repositório do GitHub..."
  git clone https://github.com/borgh/BorghControl.git "$REPO_DIR"
  cd "$REPO_DIR"
fi

echo ">>> Instalando dependências..."
npm install --legacy-peer-deps 2>&1 | tail -3

echo ">>> Buildando frontend (Vite)..."
NODE_ENV=production npx vite build --outDir ../dist/public 2>&1 | tail -5

echo ">>> Buildando servidor (esbuild)..."
node_modules/.bin/esbuild server/_core/index.ts \
  --platform=node \
  --bundle \
  --format=cjs \
  --outfile=../dist/index.cjs \
  --external:pg-native \
  --external:better-sqlite3 \
  --external:mysql2 \
  --external:oracledb \
  --external:tedious \
  --external:sqlite3 \
  --external:@vite/client \
  --external:vite 2>&1 | tail -5

echo ">>> Reiniciando PM2..."
pm2 restart borghcontrol || pm2 start "$PROJECT_DIR/dist/index.cjs" --name borghcontrol

echo ""
echo "=== Deploy concluído! ==="
pm2 status
