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

echo ">>> Instalando ferramentas de build globalmente..."
npm install -g esbuild@0.25.0 vite@7.1.7 2>&1 | tail -3

echo ">>> Instalando dependências do projeto..."
npm install --legacy-peer-deps 2>&1 | tail -5

echo ">>> Buildando frontend (Vite)..."
NODE_ENV=production vite build --outDir "$PROJECT_DIR/dist/public" 2>&1 | tail -8

echo ">>> Buildando servidor (esbuild)..."
esbuild server/_core/index.ts \
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
