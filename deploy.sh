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

cd "$REPO_DIR"

echo ">>> Instalando dependências (incluindo devDependencies)..."
npm install --include=dev --legacy-peer-deps 2>&1 | tail -5

echo ">>> Verificando ferramentas de build..."
ls node_modules/.bin/vite node_modules/.bin/esbuild 2>/dev/null || echo "AVISO: ferramentas nao encontradas em node_modules/.bin/"

echo ">>> Buildando frontend (Vite)..."
NODE_ENV=production ./node_modules/.bin/vite build --outDir "$PROJECT_DIR/dist/public" 2>&1 | tail -8

echo ">>> Buildando servidor (esbuild)..."
./node_modules/.bin/esbuild server/_core/index.ts \
  --platform=node \
  --bundle \
  --format=cjs \
  --outfile="$PROJECT_DIR/dist/index.cjs" \
  --external:pg-native \
  --external:better-sqlite3 \
  --external:mysql2 \
  --external:oracledb \
  --external:tedious \
  --external:sqlite3 \
  --external:@vite/client \
  --external:vite 2>&1 | tail -5

echo ">>> Verificando bundle..."
ls -lh "$PROJECT_DIR/dist/index.cjs"
ls -lh "$PROJECT_DIR/dist/public/assets/"*.js 2>/dev/null | head -3

echo ">>> Reiniciando PM2..."
pm2 restart borghcontrol || pm2 start "$PROJECT_DIR/dist/index.cjs" --name borghcontrol

sleep 3
echo ""
echo "=== Deploy concluído! ==="
pm2 status
