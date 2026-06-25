import type { Express } from "express";
import multer from "multer";
import { Pool } from "pg";

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

function getPool() {
  const url = process.env.DATABASE_URL!;
  const isInternalHost =
    url.includes(".railway.internal") ||
    url.includes("localhost") ||
    url.includes("127.0.0.1");
  const ssl = isInternalHost ? undefined : { rejectUnauthorized: false };
  return new Pool({ connectionString: url, ssl });
}

export function registerUploadProjetoRoutes(app: Express) {
  // POST /api/projetos/upload-imagem
  // Se projetoId for enviado no body, atualiza a imagem do projeto existente.
  // Caso contrário, retorna os dados em base64 para ser salvo junto com o projeto.
  app.post("/api/projetos/upload-imagem", upload.single("imagem"), async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "Nenhuma imagem enviada." });
        return;
      }
      const { buffer, mimetype } = req.file;
      const projetoId = req.body.projetoId ? parseInt(req.body.projetoId, 10) : null;

      if (projetoId && !isNaN(projetoId)) {
        // Atualiza a imagem de um projeto existente diretamente no banco
        const pool = getPool();
        const client = await pool.connect();
        try {
          await client.query(
            `UPDATE projetos SET imagem_dados = $1, imagem_mime = $2, "updatedAt" = now() WHERE id = $3`,
            [buffer, mimetype, projetoId]
          );
          res.json({ success: true, url: `/api/projetos/imagem/${projetoId}` });
        } finally {
          client.release();
          await pool.end();
        }
      } else {
        // Retorna os dados em base64 para ser salvo junto com o projeto na criação
        const base64 = buffer.toString("base64");
        res.json({
          success: true,
          data: base64,
          mime: mimetype,
          url: `data:${mimetype};base64,${base64}`,
        });
      }
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

  // GET /api/projetos/imagem/:id — serve a imagem de um projeto armazenada no banco
  app.get("/api/projetos/imagem/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).send("ID inválido.");
        return;
      }
      const pool = getPool();
      const client = await pool.connect();
      try {
        const result = await client.query(
          `SELECT imagem_dados, imagem_mime FROM projetos WHERE id = $1`,
          [id]
        );
        if (result.rows.length === 0 || !result.rows[0].imagem_dados) {
          res.status(404).send("Imagem não encontrada.");
          return;
        }
        const { imagem_dados, imagem_mime } = result.rows[0];
        res.setHeader("Content-Type", imagem_mime || "image/jpeg");
        res.setHeader("Cache-Control", "no-cache, must-revalidate");
        res.send(imagem_dados);
      } finally {
        client.release();
        await pool.end();
      }
    } catch (err: any) {
      console.error("[UploadProjeto] Erro ao servir imagem:", err?.message);
      res.status(500).send("Erro interno.");
    }
  });
}
