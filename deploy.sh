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

echo ">>> Verificando/instalando pnpm..."
if ! command -v pnpm &> /dev/null; then
  echo "pnpm nao encontrado, instalando..."
  npm install -g pnpm
fi
pnpm --version

echo ">>> Instalando dependencias..."
# Limpa node_modules para garantir instalação limpa com hoisted linker
rm -rf node_modules
pnpm install --no-frozen-lockfile --node-linker=hoisted 2>&1 | tail -8

echo ">>> Verificando ferramentas de build..."
if [ ! -f "node_modules/.bin/vite" ] || [ ! -f "node_modules/.bin/esbuild" ]; then
  echo "ERRO: ferramentas nao encontradas em node_modules/.bin/"
  echo "Tentando instalar globalmente..."
  npm install -g esbuild vite
  VITE_BIN="vite"
  ESBUILD_BIN="esbuild"
else
  echo "Ferramentas encontradas em node_modules/.bin/"
  VITE_BIN="./node_modules/.bin/vite"
  ESBUILD_BIN="./node_modules/.bin/esbuild"
fi

echo ">>> Buildando frontend (Vite)..."
NODE_ENV=production $VITE_BIN build --outDir "$PROJECT_DIR/dist/public" 2>&1 | tail -8

echo ">>> Buildando servidor (esbuild)..."
$ESBUILD_BIN server/_core/index.ts \
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
  --external:vite \
  --external:lightningcss \
  --external:@tailwindcss/oxide \
  --external:@babel/preset-typescript \
  --log-level=warning 2>&1 | tail -5

echo ">>> Verificando bundle..."
ls -lh "$PROJECT_DIR/dist/index.cjs"
ls -lh "$PROJECT_DIR/dist/public/assets/"*.js 2>/dev/null | head -3

echo ">>> Reiniciando PM2..."
pm2 restart borghcontrol || pm2 start "$PROJECT_DIR/dist/index.cjs" --name borghcontrol
sleep 3

echo ""
echo "=== Deploy concluído! ==="
pm2 status
