import { Pool } from "pg";

// Categorias padrão do BorghControl
const CATEGORIAS_SEED = [
  { nome: "Moradia", tipo: "despesa", cor: "#ef4444", icone: "home" },
  { nome: "Alimentação", tipo: "despesa", cor: "#f97316", icone: "utensils" },
  { nome: "Saúde", tipo: "despesa", cor: "#ec4899", icone: "heart-pulse" },
  { nome: "Transporte", tipo: "despesa", cor: "#8b5cf6", icone: "car" },
  { nome: "Educação", tipo: "despesa", cor: "#06b6d4", icone: "graduation-cap" },
  { nome: "Lazer", tipo: "despesa", cor: "#84cc16", icone: "gamepad-2" },
  { nome: "Tecnologia", tipo: "despesa", cor: "#3b82f6", icone: "monitor" },
  { nome: "Seguros", tipo: "despesa", cor: "#f59e0b", icone: "shield" },
  { nome: "Impostos", tipo: "despesa", cor: "#dc2626", icone: "landmark" },
  { nome: "Cartão de Crédito", tipo: "despesa", cor: "#7c3aed", icone: "credit-card" },
  { nome: "Investimentos", tipo: "despesa", cor: "#059669", icone: "trending-up" },
  { nome: "Outros Gastos", tipo: "despesa", cor: "#6b7280", icone: "more-horizontal" },
  { nome: "Salário / Honorários", tipo: "receita", cor: "#10b981", icone: "wallet" },
  { nome: "Serviços de T.I.", tipo: "receita", cor: "#0ea5e9", icone: "briefcase" },
  { nome: "Outras Receitas", tipo: "receita", cor: "#6b7280", icone: "plus-circle" },
];

// Receitas fixas mensais (dados da planilha RECEITA)
const RECEITAS_FIXAS = [
  { descricao: "SUCESSO CONTABILIDADE", valor: 800, dia: 1, forma: "PIX" },
  { descricao: "FARMÁCIA AMAREN", valor: 1000, dia: 5, forma: "BOLETO" },
  { descricao: "ESPAÇO INFANTIL CRESCER - BACKUP EM NUVEM", valor: 200, dia: 5, forma: "BOLETO" },
  { descricao: "MOULIN - BACKUP EM NUVEM", valor: 460, dia: 6, forma: "BOLETO" },
  { descricao: "TASSO & SCALZER CONTABILIDADE - T.I. E BACKUP", valor: 990, dia: 10, forma: "BOLETO" },
  { descricao: "CONDOMÍNIO PRAIA DA SEREIA - T.I. E BACKUP", valor: 200, dia: 10, forma: "BOLETO" },
  { descricao: "CONDOMÍNIO PRAIA DE ITAPUA - T.I. E BACKUP", valor: 200, dia: 10, forma: "BOLETO" },
  { descricao: "CONDOMÍNIO PEDRA BRANCA - T.I. E BACKUP", valor: 200, dia: 10, forma: "BOLETO" },
  { descricao: "CLÍNICA MÉDICA CAMPECHE - T.I. E BACKUP", valor: 200, dia: 10, forma: "BOLETO" },
  { descricao: "RESTAURANTE BEIRA MAR - T.I. E BACKUP", valor: 200, dia: 15, forma: "BOLETO" },
];

// Despesas mensais recorrentes (baseadas na planilha)
const DESPESAS_RECORRENTES = [
  { descricao: "Google G-Suites", valor: 473, dia: 1, cat: "Tecnologia" },
  { descricao: "LOTE VALE DO LUAR - CONDOMÍNIO - CONDONAL", valor: 350, dia: 7, cat: "Moradia" },
  { descricao: "CARTÃO CRÉDITO - MÃE", valor: 150, dia: 7, cat: "Cartão de Crédito" },
  { descricao: "PORTO SEGURO - SEGURO VIDA - MARIA DE LOURDES", valor: 185, dia: 8, cat: "Seguros" },
  { descricao: "CONDOMÍNIO - PRAIA DE ITAPUA", valor: 550, dia: 10, cat: "Moradia" },
  { descricao: "TACIANA FAXINEIRA", valor: 440, dia: 10, cat: "Moradia" },
  { descricao: "PLANO DE SAÚDE", valor: 1800, dia: 10, cat: "Saúde" },
  { descricao: "DYLAN - WIZARD IDIOMAS", valor: 305.5, dia: 5, cat: "Educação" },
  { descricao: "INTERNET - VIVO FIBRA", valor: 180, dia: 15, cat: "Tecnologia" },
  { descricao: "CELULAR - VIVO", valor: 120, dia: 15, cat: "Tecnologia" },
];

// Despesas variáveis por mês (dados reais da planilha)
const DESPESAS_VARIAVEIS: Array<{descricao:string,valor:number,mes:number,ano:number,dia:number,cat:string,status:string}> = [
  // Janeiro 2025
  { descricao: "LUZ", valor: 1300, mes: 1, ano: 2025, dia: 10, cat: "Moradia", status: "pago" },
  { descricao: "IMPOSTO - PARCELAMENTO", valor: 309.79, mes: 1, ano: 2025, dia: 1, cat: "Impostos", status: "pago" },
  // Fevereiro 2025
  { descricao: "LUZ", valor: 1200, mes: 2, ano: 2025, dia: 10, cat: "Moradia", status: "pago" },
  { descricao: "IMPOSTO - PARCELAMENTO", valor: 309.79, mes: 2, ano: 2025, dia: 1, cat: "Impostos", status: "pago" },
  // Março 2025
  { descricao: "LUZ", valor: 700, mes: 3, ano: 2025, dia: 10, cat: "Moradia", status: "pago" },
  // Abril 2025
  { descricao: "LUZ", valor: 700, mes: 4, ano: 2025, dia: 10, cat: "Moradia", status: "pago" },
  { descricao: "IMPOSTO - PARCELAMENTO", valor: 309.79, mes: 4, ano: 2025, dia: 1, cat: "Impostos", status: "pago" },
  // Maio 2025
  { descricao: "LUZ", valor: 700, mes: 5, ano: 2025, dia: 10, cat: "Moradia", status: "pago" },
  { descricao: "IMPOSTO - PARCELAMENTO", valor: 309.79, mes: 5, ano: 2025, dia: 1, cat: "Impostos", status: "pago" },
  // Junho 2025
  { descricao: "LUZ", valor: 700, mes: 6, ano: 2025, dia: 10, cat: "Moradia", status: "pago" },
  { descricao: "LÉO SÓCIO - Adega - 05/10", valor: 631.8, mes: 6, ano: 2025, dia: 10, cat: "Outros Gastos", status: "pago" },
  // Julho 2025
  { descricao: "LUZ", valor: 1000, mes: 7, ano: 2025, dia: 10, cat: "Moradia", status: "pago" },
  { descricao: "IMPOSTO - PARCELAMENTO", valor: 309.79, mes: 7, ano: 2025, dia: 1, cat: "Impostos", status: "pago" },
  // Agosto 2025
  { descricao: "LUZ", valor: 1200, mes: 8, ano: 2025, dia: 10, cat: "Moradia", status: "pago" },
  { descricao: "IMPOSTO - PARCELAMENTO", valor: 309.79, mes: 8, ano: 2025, dia: 1, cat: "Impostos", status: "pago" },
  // Setembro 2025
  { descricao: "LUZ", valor: 1600, mes: 9, ano: 2025, dia: 10, cat: "Moradia", status: "pago" },
  { descricao: "IMPOSTO - PARCELAMENTO", valor: 309.79, mes: 9, ano: 2025, dia: 1, cat: "Impostos", status: "pago" },
  // Outubro 2025
  { descricao: "LUZ", valor: 1600, mes: 10, ano: 2025, dia: 10, cat: "Moradia", status: "pendente" },
  { descricao: "IMPOSTO - PARCELAMENTO - 01/29", valor: 309.79, mes: 10, ano: 2025, dia: 1, cat: "Impostos", status: "pendente" },
  { descricao: "EMPRÉSTIMO NUBANK", valor: 850, mes: 10, ano: 2025, dia: 20, cat: "Outros Gastos", status: "pendente" },
  { descricao: "COND. PRAIA DA SEREIA - COMISSÃO EDUARDO", valor: 90, mes: 10, ano: 2025, dia: 10, cat: "Moradia", status: "pago" },
  // Novembro 2025
  { descricao: "LUZ", valor: 1400, mes: 11, ano: 2025, dia: 10, cat: "Moradia", status: "pendente" },
  { descricao: "IMPOSTO - PARCELAMENTO", valor: 309.79, mes: 11, ano: 2025, dia: 1, cat: "Impostos", status: "pendente" },
  { descricao: "EMPRÉSTIMO NUBANK", valor: 850, mes: 11, ano: 2025, dia: 20, cat: "Outros Gastos", status: "pendente" },
  // Dezembro 2025
  { descricao: "LUZ", valor: 1500, mes: 12, ano: 2025, dia: 10, cat: "Moradia", status: "pendente" },
  { descricao: "IMPOSTO - PARCELAMENTO", valor: 309.79, mes: 12, ano: 2025, dia: 1, cat: "Impostos", status: "pendente" },
  { descricao: "EMPRÉSTIMO NUBANK", valor: 850, mes: 12, ano: 2025, dia: 20, cat: "Outros Gastos", status: "pendente" },
  // 2026 - Março
  { descricao: "Google G-Suites", valor: 473, mes: 3, ano: 2026, dia: 1, cat: "Tecnologia", status: "pago" },
  { descricao: "LUZ", valor: 700, mes: 3, ano: 2026, dia: 10, cat: "Moradia", status: "pago" },
  { descricao: "LOTE VALE DO LUAR - CONDOMÍNIO - CONDONAL", valor: 350, mes: 3, ano: 2026, dia: 7, cat: "Moradia", status: "pago" },
  { descricao: "CARTÃO CRÉDITO - MÃE - 05/12", valor: 150, mes: 3, ano: 2026, dia: 7, cat: "Cartão de Crédito", status: "pago" },
  { descricao: "PORTO SEGURO - SEGURO VIDA - MARIA DE LOURDES", valor: 185, mes: 3, ano: 2026, dia: 8, cat: "Seguros", status: "pendente" },
  // 2026 - Abril
  { descricao: "Google G-Suites", valor: 473, mes: 4, ano: 2026, dia: 1, cat: "Tecnologia", status: "pago" },
  { descricao: "LUZ", valor: 700, mes: 4, ano: 2026, dia: 10, cat: "Moradia", status: "pendente" },
  { descricao: "CARTÃO CRÉDITO - MÃE - 06/12", valor: 150, mes: 4, ano: 2026, dia: 7, cat: "Cartão de Crédito", status: "pago" },
  { descricao: "PORTO SEGURO - SEGURO VIDA - MARIA DE LOURDES", valor: 185, mes: 4, ano: 2026, dia: 8, cat: "Seguros", status: "pendente" },
  // 2026 - Maio
  { descricao: "Google G-Suites", valor: 473, mes: 5, ano: 2026, dia: 1, cat: "Tecnologia", status: "pendente" },
  { descricao: "LUZ", valor: 700, mes: 5, ano: 2026, dia: 10, cat: "Moradia", status: "pendente" },
  { descricao: "CARTÃO CRÉDITO - MÃE - 07/12", valor: 150, mes: 5, ano: 2026, dia: 7, cat: "Cartão de Crédito", status: "pendente" },
  { descricao: "PORTO SEGURO - SEGURO VIDA - MARIA DE LOURDES", valor: 185, mes: 5, ano: 2026, dia: 8, cat: "Seguros", status: "pendente" },
  // 2026 - Junho
  { descricao: "Google G-Suites", valor: 473, mes: 6, ano: 2026, dia: 1, cat: "Tecnologia", status: "pendente" },
  { descricao: "LUZ", valor: 700, mes: 6, ano: 2026, dia: 10, cat: "Moradia", status: "pendente" },
  { descricao: "CARTÃO CRÉDITO - MÃE - 08/12", valor: 150, mes: 6, ano: 2026, dia: 7, cat: "Cartão de Crédito", status: "pago" },
  { descricao: "PORTO SEGURO - SEGURO VIDA - MARIA DE LOURDES", valor: 185, mes: 6, ano: 2026, dia: 8, cat: "Seguros", status: "pendente" },
];

export async function initDatabase(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("[BorghControl DB] DATABASE_URL não configurada.");
    return;
  }

  const isPostgres = url.startsWith("postgresql://") || url.startsWith("postgres://");
  if (!isPostgres) {
    console.log("[BorghControl DB] Banco não-PostgreSQL detectado, pulando init.");
    return;
  }

  // Para hosts internos do Railway (.railway.internal), não usar SSL
  const isInternalHost = url.includes(".railway.internal") || url.includes("localhost") || url.includes("127.0.0.1");
  const sslConfigs: any[] = isInternalHost ? [false, { rejectUnauthorized: false }] : [{ rejectUnauthorized: false }, false];
  for (const ssl of sslConfigs) {
    const pool = new Pool({ connectionString: url, ssl: ssl === false ? undefined : ssl });
    try {
      const client = await pool.connect();

      // Criar enums e tabelas
      await client.query(`
        DO $$ BEGIN CREATE TYPE "role" AS ENUM('user', 'admin'); EXCEPTION WHEN duplicate_object THEN null; END $$;
        DO $$ BEGIN CREATE TYPE "status_transacao" AS ENUM('pendente', 'pago', 'cancelado'); EXCEPTION WHEN duplicate_object THEN null; END $$;
        DO $$ BEGIN CREATE TYPE "tipo_transacao" AS ENUM('despesa', 'receita'); EXCEPTION WHEN duplicate_object THEN null; END $$;
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS "users" (
          "id" serial PRIMARY KEY,
          "openId" varchar(64) NOT NULL UNIQUE,
          "name" text,
          "email" varchar(320),
          "passwordHash" varchar(255),
          "loginMethod" varchar(64),
          "role" "role" DEFAULT 'user' NOT NULL,
          "createdAt" timestamp DEFAULT now() NOT NULL,
          "updatedAt" timestamp DEFAULT now() NOT NULL,
          "lastSignedIn" timestamp DEFAULT now() NOT NULL
        );
        CREATE TABLE IF NOT EXISTS "categorias" (
          "id" serial PRIMARY KEY,
          "nome" varchar(100) NOT NULL,
          "tipo" "tipo_transacao" NOT NULL,
          "cor" varchar(7) DEFAULT '#6366f1',
          "icone" varchar(50) DEFAULT 'tag',
          "createdAt" timestamp DEFAULT now() NOT NULL
        );
        CREATE TABLE IF NOT EXISTS "transacoes" (
          "id" serial PRIMARY KEY,
          "descricao" varchar(255) NOT NULL,
          "valor" numeric(12, 2) NOT NULL,
          "tipo" "tipo_transacao" NOT NULL,
          "status" "status_transacao" DEFAULT 'pendente' NOT NULL,
          "vencimentoTexto" varchar(20),
          "diaVencimento" integer,
          "mes" integer NOT NULL,
          "ano" integer NOT NULL,
          "categoriaId" integer,
          "formaPagamento" varchar(50),
          "observacao" text,
          "recorrente" boolean DEFAULT false,
          "createdAt" timestamp DEFAULT now() NOT NULL,
          "updatedAt" timestamp DEFAULT now() NOT NULL
        );
        CREATE INDEX IF NOT EXISTS "idx_mes_ano" ON "transacoes" ("mes","ano");
        CREATE INDEX IF NOT EXISTS "idx_tipo" ON "transacoes" ("tipo");
        CREATE INDEX IF NOT EXISTS "idx_status" ON "transacoes" ("status");
      `);

      // Tabela de anexos de transações
      await client.query(`
        CREATE TABLE IF NOT EXISTS transacao_anexos (
          id serial PRIMARY KEY,
          transacao_id integer NOT NULL,
          nome_arquivo varchar(255) NOT NULL,
          mime_type varchar(100) NOT NULL,
          tamanho integer NOT NULL,
          dados bytea NOT NULL,
          created_at timestamp DEFAULT now() NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_anexos_transacao ON transacao_anexos (transacao_id);
      `);

      // Migrations de colunas adicionadas após criação inicial das tabelas
      await client.query(`
        ALTER TABLE IF EXISTS projetos ADD COLUMN IF NOT EXISTS imagem_fit VARCHAR(20) DEFAULT 'cover';

        -- Tabelas de backup
        CREATE TABLE IF NOT EXISTS backup_agendamentos (
          id SERIAL PRIMARY KEY,
          ativo BOOLEAN NOT NULL DEFAULT true,
          dias_semana TEXT,
          horario VARCHAR(5) NOT NULL DEFAULT '02:00',
          email_destino VARCHAR(255) NOT NULL DEFAULT 'borgh@smfusion.com.br',
          incluir_sql BOOLEAN NOT NULL DEFAULT true,
          incluir_csv BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS backup_logs (
          id SERIAL PRIMARY KEY,
          agendamento_id INTEGER,
          status VARCHAR(20) NOT NULL,
          tipo VARCHAR(20) NOT NULL DEFAULT 'agendado',
          mensagem TEXT,
          detalhes TEXT,
          tamanho_sql INTEGER,
          total_csvs INTEGER,
          email_enviado BOOLEAN DEFAULT false,
          iniciado_em TIMESTAMP NOT NULL DEFAULT NOW(),
          finalizado_em TIMESTAMP
        );
      `);

      // Seed categorias
      const catCount = await client.query('SELECT COUNT(*) FROM "categorias"');
      if (parseInt(catCount.rows[0].count) === 0) {
        for (const cat of CATEGORIAS_SEED) {
          await client.query(
            'INSERT INTO "categorias" ("nome","tipo","cor","icone") VALUES ($1,$2,$3,$4)',
            [cat.nome, cat.tipo, cat.cor, cat.icone]
          );
        }
        console.log("[BorghControl DB] Categorias inseridas.");
      }

      // Seed transações
      const txCount = await client.query('SELECT COUNT(*) FROM "transacoes"');
      if (parseInt(txCount.rows[0].count) === 0) {
        // Mapa de categorias
        const catRows = await client.query('SELECT id, nome FROM "categorias"');
        const catMap: Record<string, number> = {};
        for (const row of catRows.rows) catMap[row.nome] = row.id;

        // Inserir receitas para cada mês de 2025
        for (let mes = 1; mes <= 12; mes++) {
          const catId = catMap["Serviços de T.I."] || null;
          for (const r of RECEITAS_FIXAS) {
            await client.query(
              `INSERT INTO "transacoes" ("descricao","valor","tipo","status","vencimentoTexto","diaVencimento","mes","ano","categoriaId","formaPagamento","recorrente")
               VALUES ($1,$2,'receita',$3,$4,$5,$6,2025,$7,$8,true)`,
              [r.descricao, r.valor, mes <= 9 ? "pago" : "pendente", `DIA ${String(r.dia).padStart(2, "0")}`, r.dia, mes, catId, r.forma]
            );
          }
        }

        // Inserir despesas recorrentes para cada mês de 2025
        for (let mes = 1; mes <= 12; mes++) {
          for (const d of DESPESAS_RECORRENTES) {
            const catId = catMap[d.cat] || null;
            await client.query(
              `INSERT INTO "transacoes" ("descricao","valor","tipo","status","vencimentoTexto","diaVencimento","mes","ano","categoriaId","recorrente")
               VALUES ($1,$2,'despesa',$3,$4,$5,$6,2025,$7,true)`,
              [d.descricao, d.valor, mes <= 9 ? "pago" : "pendente", `DIA ${String(d.dia).padStart(2, "0")}`, d.dia, mes, catId]
            );
          }
        }

        // Inserir despesas variáveis
        for (const d of DESPESAS_VARIAVEIS) {
          const catId = catMap[d.cat] || null;
          await client.query(
            `INSERT INTO "transacoes" ("descricao","valor","tipo","status","vencimentoTexto","diaVencimento","mes","ano","categoriaId","recorrente")
             VALUES ($1,$2,'despesa',$3,$4,$5,$6,$7,$8,false)`,
            [d.descricao, d.valor, d.status, `DIA ${String(d.dia).padStart(2, "0")}`, d.dia, d.mes, d.ano, catId]
          );
        }

        console.log("[BorghControl DB] Transações da planilha inseridas.");
      }

      client.release();
      await pool.end();
      console.log("[BorghControl DB] Inicialização concluída.");
      return;
    } catch (err: any) {
      await pool.end().catch(() => {});
      console.error("[BorghControl DB] Tentativa falhou:", err?.message, "| SSL:", ssl);
      if (err?.message?.includes("SSL") || err?.code === "ECONNREFUSED" || err?.message?.includes("connect")) continue;
      console.error("[BorghControl DB] Erro não-SSL, abortando:", err?.message);
      return;
    }
  }
}
