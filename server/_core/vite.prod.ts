// Production stub - does NOT import vite (avoids bundling dev-only code)
import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export async function setupVite(_app: Express, _server: unknown) {
  // No-op in production
}

export function serveStatic(app: Express) {
  // In production, __dirname resolves to the dist/ folder where index.cjs lives
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  console.log(`Serving static files from: ${distPath}`);
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
