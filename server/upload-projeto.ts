import type { Express } from "express";
import multer from "multer";
import { Pool } from "pg";

// Pool compartilhado — reutilizado entre requisições
let _pool: Pool | null = null;
function getPool(): Pool {
  if (!_pool) {
    const url = process.env.DATABASE_URL!;
    const isInternalHost =
      url.includes(".railway.internal") ||
      url.includes("localhost") ||
      url.includes("127.0.0.1");
    const ssl = isInternalHost ? undefined : { rejectUnauthorized: false };
    _pool = new Pool({ connectionString: url, ssl, max: 5 });
  }
  return _pool;
}

// Cache em memória: { id -> { buffer, mime, etag, ts } }
const imageCache = new Map<number, { buffer: Buffer; mime: string; etag: string; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Tipo de arquivo não permitido. Use JPG, PNG, WEBP ou GIF."));
    }
  },
});

async function comprimirImagem(buffer: Buffer, _mime: string): Promise<{ buffer: Buffer; mime: string }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sharp = require("sharp");
    const compressed = await sharp(buffer)
      .resize({ width: 800, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    console.log(`[UploadProjeto] Comprimido: ${buffer.length} → ${compressed.length} bytes (WebP)`);
    return { buffer: compressed, mime: "image/webp" };
  } catch (err: any) {
    console.warn("[UploadProjeto] sharp indisponível, salvando original:", err?.message);
    return { buffer, mime: _mime };
  }
}

export function registerUploadProjetoRoutes(app: Express) {
  // POST /api/projetos/upload-imagem
  app.post("/api/projetos/upload-imagem", upload.single("imagem"), async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "Nenhuma imagem enviada." });
        return;
      }
      const { buffer, mimetype } = req.file;
      const projetoId = req.body.projetoId ? parseInt(req.body.projetoId, 10) : null;

      const { buffer: compBuffer, mime: compMime } = await comprimirImagem(buffer, mimetype);

      if (projetoId && !isNaN(projetoId)) {
        const pool = getPool();
        await pool.query(
          `UPDATE projetos SET imagem_dados = $1, imagem_mime = $2, "updatedAt" = now() WHERE id = $3`,
          [compBuffer, compMime, projetoId]
        );
        // Invalidar cache para este projeto
        imageCache.delete(projetoId);
        res.json({ success: true, url: `/api/projetos/imagem/${projetoId}` });
      } else {
        const base64 = compBuffer.toString("base64");
        res.json({
          success: true,
          data: base64,
          mime: compMime,
          url: `data:${compMime};base64,${base64}`,
        });
      }
    } catch (err: any) {
      console.error("[UploadProjeto] Erro:", err?.message);
      if (err?.message?.includes("Tipo de arquivo")) {
        res.status(400).json({ error: err.message });
      } else if (err?.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ error: "Imagem muito grande. Máximo: 20MB." });
      } else {
        res.status(500).json({ error: "Erro interno ao salvar imagem." });
      }
    }
  });

  // GET /api/projetos/imagem/:id — serve imagem com cache em memória + HTTP cache
  app.get("/api/projetos/imagem/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).send("ID inválido.");
        return;
      }

      const now = Date.now();
      const cached = imageCache.get(id);

      // Verificar ETag antes de qualquer query
      if (cached && now - cached.ts < CACHE_TTL_MS) {
        if (req.headers["if-none-match"] === cached.etag) {
          res.status(304).end();
          return;
        }
        res.setHeader("Content-Type", cached.mime);
        res.setHeader("Cache-Control", "public, max-age=604800, stale-while-revalidate=2592000");
        res.setHeader("ETag", cached.etag);
        res.send(cached.buffer);
        return;
      }

      // Cache miss ou expirado: buscar do banco
      const pool = getPool();
      const result = await pool.query(
        `SELECT imagem_dados, imagem_mime, "updatedAt" FROM projetos WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0 || !result.rows[0].imagem_dados) {
        res.status(404).send("Imagem não encontrada.");
        return;
      }

      const { imagem_dados, imagem_mime, updatedAt } = result.rows[0];
      const etag = `"proj-${id}-${updatedAt ? new Date(updatedAt).getTime() : Date.now()}"`;

      // Salvar no cache em memória
      imageCache.set(id, { buffer: imagem_dados, mime: imagem_mime || "image/webp", etag, ts: now });

      if (req.headers["if-none-match"] === etag) {
        res.status(304).end();
        return;
      }

      res.setHeader("Content-Type", imagem_mime || "image/webp");
      res.setHeader("Cache-Control", "public, max-age=604800, stale-while-revalidate=2592000");
      res.setHeader("ETag", etag);
      res.send(imagem_dados);
    } catch (err: any) {
      console.error("[UploadProjeto] Erro ao servir imagem:", err?.message);
      res.status(500).send("Erro interno.");
    }
  });
}
