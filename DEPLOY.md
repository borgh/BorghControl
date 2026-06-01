# VagaWin — Guia de Deploy Gratuito (Neon + Render)

## Visão Geral

O VagaWin pode ser hospedado gratuitamente usando:
- **Neon** — banco de dados PostgreSQL gratuito (neon.tech)
- **Render** — hospedagem de aplicações Node.js gratuita (render.com)

---

## Passo 1 — Criar banco de dados no Neon (gratuito)

1. Acesse [https://neon.tech](https://neon.tech) e crie uma conta gratuita
2. Clique em **"New Project"**
3. Escolha um nome (ex: `vagawin`) e a região mais próxima (ex: `US East`)
4. Após criar, copie a **Connection String** no formato:
   ```
   postgresql://usuario:senha@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
5. Guarde essa string — ela será a variável `DATABASE_URL`

---

## Passo 2 — Fazer deploy no Render (gratuito)

1. Acesse [https://render.com](https://render.com) e crie uma conta gratuita
2. Clique em **"New +"** → **"Web Service"**
3. Conecte sua conta GitHub e selecione o repositório **VagaWin**
4. Configure o serviço:
   - **Name:** vagawin
   - **Branch:** main
   - **Runtime:** Node
   - **Build Command:** `npm install -g pnpm && pnpm install && pnpm run build`
   - **Start Command:** `node dist/index.js`
   - **Plan:** Free

5. Na seção **Environment Variables**, adicione:
   | Variável | Valor |
   |----------|-------|
   | `DATABASE_URL` | (sua connection string do Neon) |
   | `JWT_SECRET` | (qualquer string aleatória longa, ex: `vagawin-super-secret-2024`) |
   | `NODE_ENV` | `production` |

6. Clique em **"Create Web Service"**

O Render vai fazer o build e deploy automaticamente. O processo leva ~5 minutos.

---

## Passo 3 — Acessar o sistema

Após o deploy, o Render fornecerá uma URL no formato:
```
https://vagawin.onrender.com
```

Acesse a URL e **crie sua conta** — o primeiro usuário registrado se torna administrador automaticamente.

---

## Notas Importantes

- O plano gratuito do Render "hiberna" após 15 minutos de inatividade. O primeiro acesso pode demorar ~30 segundos para "acordar" o servidor.
- O banco de dados Neon gratuito tem 512 MB de armazenamento, suficiente para centenas de condomínios.
- Para evitar hibernação, considere o plano pago do Render ($7/mês) ou use um serviço de "ping" gratuito como o UptimeRobot.

---

## Repositório GitHub

O código está disponível em: https://github.com/borgh/VagaWin
