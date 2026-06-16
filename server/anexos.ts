import type { Express } from "express";
import multer from "multer";
import { Pool } from "pg";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

// Multer em memória (sem disco)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Tipo de arquivo não permitido. Use imagem (JPG, PNG, GIF, WEBP) ou PDF."));
    }
  },
});

function getPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada");
  const isInternalHost = url.includes(".railway.internal") || url.includes("localhost") || url.includes("127.0.0.1");
  const ssl = isInternalHost ? undefined : { rejectUnauthorized: false };
  return new Pool({ connectionString: url, ssl });
}

export function registerAnexosRoutes(app: Express) {
  // POST /api/anexos/upload/:transacaoId  — faz upload de um arquivo
  app.post("/api/anexos/upload/:transacaoId", upload.single("arquivo"), async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "Nenhum arquivo enviado." });
        return;
      }
      const transacaoId = parseInt(req.params.transacaoId, 10);
      if (isNaN(transacaoId)) {
        res.status(400).json({ error: "ID de transação inválido." });
        return;
      }
      const { originalname, mimetype, size, buffer } = req.file;

      const pool = getPool();
      const client = await pool.connect();
      try {
        const result = await client.query(
          `INSERT INTO transacao_anexos (transacao_id, nome_arquivo, mime_type, tamanho, dados)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, transacao_id, nome_arquivo, mime_type, tamanho, created_at`,
          [transacaoId, originalname, mimetype, size, buffer]
        );
        res.json({ success: true, anexo: result.rows[0] });
      } finally {
        client.release();
        await pool.end();
      }
    } catch (err: any) {
      console.error("[Anexos] Erro no upload:", err?.message);
      if (err?.message?.includes("Tipo de arquivo")) {
        res.status(400).json({ error: err.message });
      } else if (err?.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ error: "Arquivo muito grande. Máximo permitido: 5MB." });
      } else {
        res.status(500).json({ error: "Erro interno ao salvar arquivo." });
      }
    }
  });

  // GET /api/anexos/list/:transacaoId  — lista os anexos de uma transação (sem dados)
  app.get("/api/anexos/list/:transacaoId", async (req, res) => {
    try {
      const transacaoId = parseInt(req.params.transacaoId, 10);
      if (isNaN(transacaoId)) {
        res.status(400).json({ error: "ID de transação inválido." });
        return;
      }
      const pool = getPool();
      const client = await pool.connect();
      try {
        const result = await client.query(
          `SELECT id, transacao_id, nome_arquivo, mime_type, tamanho, created_at
           FROM transacao_anexos
           WHERE transacao_id = $1
           ORDER BY created_at ASC`,
          [transacaoId]
        );
        res.json({ anexos: result.rows });
      } finally {
        client.release();
        await pool.end();
      }
    } catch (err: any) {
      console.error("[Anexos] Erro ao listar:", err?.message);
      res.status(500).json({ error: "Erro interno ao listar anexos." });
    }
  });

  // GET /api/anexos/view/:id  — serve o arquivo para visualização/download
  app.get("/api/anexos/view/:id", async (req, res) => {
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
          `SELECT nome_arquivo, mime_type, dados FROM transacao_anexos WHERE id = $1`,
          [id]
        );
        if (result.rows.length === 0) {
          res.status(404).send("Arquivo não encontrado.");
          return;
        }
        const { nome_arquivo, mime_type, dados } = result.rows[0];
        res.setHeader("Content-Type", mime_type);
        res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(nome_arquivo)}"`);
        res.setHeader("Cache-Control", "private, max-age=3600");
        res.send(dados);
      } finally {
        client.release();
        await pool.end();
      }
    } catch (err: any) {
      console.error("[Anexos] Erro ao servir arquivo:", err?.message);
      res.status(500).send("Erro interno.");
    }
  });

  // DELETE /api/anexos/:id  — remove um anexo
  app.delete("/api/anexos/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }
      const pool = getPool();
      const client = await pool.connect();
      try {
        const result = await client.query(
          `DELETE FROM transacao_anexos WHERE id = $1 RETURNING id`,
          [id]
        );
        if (result.rowCount === 0) {
          res.status(404).json({ error: "Anexo não encontrado." });
          return;
        }
        res.json({ success: true });
      } finally {
        client.release();
        await pool.end();
      }
    } catch (err: any) {
      console.error("[Anexos] Erro ao deletar:", err?.message);
      res.status(500).json({ error: "Erro interno ao remover anexo." });
    }
  });
}
