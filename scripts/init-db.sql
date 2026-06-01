-- VagaWin - Script de inicialização do banco de dados PostgreSQL
-- Execute este script no seu banco de dados Neon/PostgreSQL antes do primeiro uso

-- Enums
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

-- Tabela de usuários
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

-- Tabela de vagas
CREATE TABLE IF NOT EXISTS "vagas" (
  "id" SERIAL PRIMARY KEY,
  "numero" VARCHAR(20) NOT NULL,
  "descricao" TEXT,
  "status" "vaga_status" NOT NULL DEFAULT 'ativa',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tabela de apartamentos
CREATE TABLE IF NOT EXISTS "apartamentos" (
  "id" SERIAL PRIMARY KEY,
  "numero" VARCHAR(20) NOT NULL,
  "bloco" VARCHAR(20),
  "responsavel" VARCHAR(120),
  "status" "apt_status" NOT NULL DEFAULT 'participante',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tabela de sorteios
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
