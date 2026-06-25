import type { Express } from "express";
import multer from "multer";
import { storagePut } from "./storage";
import { randomUUID } from "crypto";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Tipo de arquivo não permitido. Use JPG, PNG, WEBP ou GIF."));
    }
  },
});

export function registerUploadProjetoRoutes(app: Express) {
  // POST /api/projetos/upload-imagem — faz upload da imagem do projeto
  app.post("/api/projetos/upload-imagem", upload.single("imagem"), async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "Nenhuma imagem enviada." });
        return;
      }
      const { buffer, mimetype, originalname } = req.file;
      const ext = originalname.split(".").pop() ?? "jpg";
      const key = `projetos/${randomUUID()}.${ext}`;
      const { url } = await storagePut(key, buffer, mimetype);
      res.json({ success: true, url, key });
    } catch (err: any) {
      console.error("[UploadProjeto] Erro:", err?.message);
      if (err?.message?.includes("Tipo de arquivo")) {
        res.status(400).json({ error: err.message });
      } else if (err?.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ error: "Imagem muito grande. Máximo: 10MB." });
      } else {
        res.status(500).json({ error: "Erro interno ao salvar imagem." });
      }
    }
  });
}
