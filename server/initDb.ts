/**
 * Inicializa o banco de dados PostgreSQL criando as tabelas se não existirem.
 * Executado automaticamente ao iniciar o servidor.
 */
import { Pool } from "pg";

const INIT_SQL = `
DO $$ BEGIN
  CREATE TYPE "role" AS ENUM('user', 'admin');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "vaga_status" AS ENUM('ativa', 'inativa');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "apt_status" AS ENUM('participante', 'nao_participante');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "users" (
  "id" SERIAL PRIMARY KEY,
  "openId" VARCHAR(64) NOT NULL UNIQUE,
  "name" TEXT,
  "email" VARCHAR(320),
  "loginMethod" VARCHAR(64),
  "passwordHash" VARCHAR(255),
  "role" "role" NOT NULL DEFAULT 'user',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "lastSignedIn" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "vagas" (
  "id" SERIAL PRIMARY KEY,
  "numero" VARCHAR(20) NOT NULL,
  "descricao" TEXT,
  "status" "vaga_status" NOT NULL DEFAULT 'ativa',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "apartamentos" (
  "id" SERIAL PRIMARY KEY,
  "numero" VARCHAR(20) NOT NULL,
  "bloco" VARCHAR(20),
  "responsavel" VARCHAR(120),
  "status" "apt_status" NOT NULL DEFAULT 'participante',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "sorteios" (
  "id" SERIAL PRIMARY KEY,
  "realizadoEm" TIMESTAMP NOT NULL DEFAULT NOW(),
  "totalParticipantes" INTEGER NOT NULL,
  "totalVagas" INTEGER NOT NULL,
  "responsavelId" INTEGER,
  "responsavelNome" VARCHAR(120),
  "resultado" JSON NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
`;

export async function initDatabase(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("[DB Init] DATABASE_URL not set, skipping init.");
    return;
  }

  // Detecta se é PostgreSQL (Neon, Render, etc.) ou outro banco
  const isPostgres = url.startsWith('postgresql://') || url.startsWith('postgres://');
  if (!isPostgres) {
    console.log("[DB Init] Non-PostgreSQL database detected, skipping PG init.");
    return;
  }

  // Tenta com SSL primeiro (Neon/produção), depois sem SSL (local)
  const sslConfigs: any[] = [{ rejectUnauthorized: false }, false];
  for (const ssl of sslConfigs) {
    const pool = new Pool({ connectionString: url, ssl });
    try {
      await pool.query(INIT_SQL);
      console.log("[DB Init] Database tables initialized successfully.");
      await pool.end();
      return;
    } catch (err: any) {
      await pool.end().catch(() => {});
      if (err?.message?.includes('SSL') || err?.code === 'ECONNREFUSED') continue;
      console.error("[DB Init] Failed to initialize database:", err);
      return;
    }
  }
  console.warn("[DB Init] Could not connect to PostgreSQL database.");
}
