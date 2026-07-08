import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite.prod";
import { initDatabase } from "../initDb";
import { iniciarCronBackup } from "../backup-cron";
import { registerUploadProjetoRoutes } from "../upload-projeto";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Initialize PostgreSQL tables on startup
  await initDatabase();
  // Iniciar cron de backup
  await iniciarCronBackup();
  registerStorageProxy(app);
  // Rotas de upload e serviço de imagens de projetos
  registerUploadProjetoRoutes(app);
  // ─── Endpoints de Deploy ────────────────────────────────────────────────────
  const DEPLOY_SECRET = process.env.DEPLOY_SECRET || "BorghDeploy2026";
  const DEPLOY_DIR = process.env.DEPLOY_DIR || "/var/www/borghcontrol";

  // Deploy do backend: recebe o bundle .cjs e reinicia o PM2
  app.post(`/deploy-temp/${DEPLOY_SECRET}`, express.raw({ type: "*/*", limit: "50mb" }), (req, res) => {
    try {
      const bundlePath = path.join(DEPLOY_DIR, "dist", "index.cjs");
      fs.mkdirSync(path.dirname(bundlePath), { recursive: true });
      fs.writeFileSync(bundlePath, req.body);
      execSync("pm2 restart borghcontrol", { stdio: "pipe" });
      res.json({ ok: true, message: "Backend deployado e PM2 reiniciado" });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Deploy do frontend: recebe o tar.gz e extrai em dist/public
  app.post(`/deploy-frontend-temp/${DEPLOY_SECRET}`, express.raw({ type: "*/*", limit: "100mb" }), (req, res) => {
    try {
      const publicDir = path.join(DEPLOY_DIR, "dist", "public");
      const tarPath = "/tmp/frontend-deploy.tar.gz";
      fs.mkdirSync(publicDir, { recursive: true });
      fs.writeFileSync(tarPath, req.body);
      execSync(`tar -xzf ${tarPath} -C ${publicDir}`, { stdio: "pipe" });
      res.json({ ok: true, message: "Frontend deployado" });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
