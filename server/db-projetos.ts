import { eq, and, desc, sql, ilike } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  socios, projetos, projetoSocios, destinosInvestimento, investimentos,
  type InsertSocio, type InsertProjeto, type InsertInvestimento, type InsertDestinoInvestimento,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;

async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    const url = process.env.DATABASE_URL;
    const isPostgres = url.startsWith("postgresql://") || url.startsWith("postgres://");
    if (!isPostgres) return null;
    try {
      const isInternalHost = url.includes(".railway.internal") || url.includes("localhost") || url.includes("127.0.0.1");
      const ssl = isInternalHost ? undefined : { rejectUnauthorized: false };
      _pool = new Pool({ connectionString: url, ssl });
      _db = drizzle(_pool);
    } catch (error) {
      console.warn("[DB-Projetos] Failed to connect:", error);
    }
  }
  return _db;
}

// ─── SÓCIOS ───────────────────────────────────────────────────────────────────
export async function listSocios(busca?: string) {
  const db = await getDb();
  if (!db) return [];
  if (busca) {
    return db.select().from(socios)
      .where(ilike(socios.nome, `%${busca}%`))
      .orderBy(socios.nome);
  }
  return db.select().from(socios).orderBy(socios.nome);
}

export async function getSocio(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(socios).where(eq(socios.id, id));
  return result[0] ?? null;
}

export async function createSocio(data: InsertSocio) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(socios).values(data).returning();
  return result[0];
}

export async function updateSocio(id: number, data: Partial<InsertSocio>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.update(socios)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(socios.id, id))
    .returning();
  return result[0];
}

export async function deleteSocio(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(socios).where(eq(socios.id, id));
  return { success: true };
}

// ─── DESTINOS DE INVESTIMENTO ─────────────────────────────────────────────────
export async function listDestinos() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(destinosInvestimento).orderBy(destinosInvestimento.nome);
}

export async function createDestino(data: InsertDestinoInvestimento) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(destinosInvestimento).values(data).returning();
  return result[0];
}

export async function updateDestino(id: number, data: Partial<InsertDestinoInvestimento>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.update(destinosInvestimento)
    .set(data)
    .where(eq(destinosInvestimento.id, id))
    .returning();
  return result[0];
}

export async function deleteDestino(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(destinosInvestimento).where(eq(destinosInvestimento.id, id));
  return { success: true };
}

// ─── PROJETOS ─────────────────────────────────────────────────────────────────
export async function listProjetos(busca?: string) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(projetos).$dynamic();
  if (busca) {
    query = query.where(ilike(projetos.nome, `%${busca}%`));
  }
  const rows = await query.orderBy(desc(projetos.createdAt));

  // Para cada projeto, busca sócios e total investido (exclui imagemDados para não sobrecarregar a resposta)
  const result = await Promise.all(rows.map(async (p) => {
    const { imagemDados: _img, ...projetoSemImagem } = p as any;
    const sociosList = await getProjetoSocios(p.id);
    const totalInvestido = await getTotalInvestidoProjeto(p.id);
    const temImagem = _img != null && (Array.isArray(_img) ? _img.length > 0 : true);
    return { ...projetoSemImagem, socios: sociosList, totalInvestido, temImagem };
  }));
  return result;
}

export async function getProjeto(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(projetos).where(eq(projetos.id, id));
  if (!result[0]) return null;
  const { imagemDados: _img, ...projetoSemImagem } = result[0] as any;
  const sociosList = await getProjetoSocios(id);
  const investList = await listInvestimentos(id);
  const totalInvestido = investList.reduce((acc, i) => acc + Number(i.valor), 0);
  const temImagem = _img != null && (Array.isArray(_img) ? _img.length > 0 : true);
  return { ...projetoSemImagem, socios: sociosList, investimentos: investList, totalInvestido, temImagem };
}

export async function createProjeto(data: InsertProjeto) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(projetos).values(data).returning();
  return result[0];
}

export async function updateProjeto(id: number, data: Partial<InsertProjeto>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.update(projetos)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(projetos.id, id))
    .returning();
  return result[0];
}

export async function deleteProjeto(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(projetos).where(eq(projetos.id, id));
  return { success: true };
}

// ─── PROJETO-SÓCIOS ───────────────────────────────────────────────────────────
export async function getProjetoSocios(projetoId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: projetoSocios.id,
      projetoId: projetoSocios.projetoId,
      socioId: projetoSocios.socioId,
      percentual: projetoSocios.percentual,
      createdAt: projetoSocios.createdAt,
      socioNome: socios.nome,
      socioEmail: socios.email,
      socioTelefone: socios.telefone,
    })
    .from(projetoSocios)
    .leftJoin(socios, eq(projetoSocios.socioId, socios.id))
    .where(eq(projetoSocios.projetoId, projetoId));
  return rows;
}

export async function setProjetoSocios(projetoId: number, socioIds: Array<{ socioId: number; percentual?: number }>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // Remove todos os sócios atuais do projeto
  await db.delete(projetoSocios).where(eq(projetoSocios.projetoId, projetoId));
  // Insere os novos
  if (socioIds.length > 0) {
    await db.insert(projetoSocios).values(
      socioIds.map((s) => ({
        projetoId,
        socioId: s.socioId,
        percentual: s.percentual ? String(s.percentual) : null,
      }))
    );
  }
  return { success: true };
}

// ─── INVESTIMENTOS ────────────────────────────────────────────────────────────
export async function listInvestimentos(projetoId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: investimentos.id,
      projetoId: investimentos.projetoId,
      valor: investimentos.valor,
      data: investimentos.data,
      destinoId: investimentos.destinoId,
      socioId: investimentos.socioId,
      descricao: investimentos.descricao,
      createdAt: investimentos.createdAt,
      destinoNome: destinosInvestimento.nome,
      investidorNome: socios.nome,
    })
    .from(investimentos)
    .leftJoin(destinosInvestimento, eq(investimentos.destinoId, destinosInvestimento.id))
    .leftJoin(socios, eq(investimentos.socioId, socios.id))
    .where(eq(investimentos.projetoId, projetoId))
    .orderBy(desc(investimentos.data));
}

export async function createInvestimento(data: InsertInvestimento) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(investimentos).values(data).returning();
  return result[0];
}

export async function updateInvestimento(id: number, data: Partial<InsertInvestimento>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.update(investimentos)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(investimentos.id, id))
    .returning();
  return result[0];
}

export async function deleteInvestimento(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(investimentos).where(eq(investimentos.id, id));
  return { success: true };
}

export async function getTotalInvestidoProjeto(projetoId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({
    total: sql<number>`COALESCE(SUM(CAST(${investimentos.valor} AS NUMERIC)), 0)`,
  }).from(investimentos).where(eq(investimentos.projetoId, projetoId));
  return Number(result[0]?.total ?? 0);
}

// ─── DASHBOARD DE PROJETOS ────────────────────────────────────────────────────
export async function getDashboardProjetos() {
  const db = await getDb();
  if (!db) return null;

  // Contagem por status
  const statusCount = await db.select({
    status: projetos.status,
    count: sql<number>`COUNT(*)`,
  }).from(projetos).groupBy(projetos.status);

  // Total investido por projeto
  const investPorProjeto = await db.select({
    projetoId: investimentos.projetoId,
    projetoNome: projetos.nome,
    total: sql<number>`COALESCE(SUM(CAST(${investimentos.valor} AS NUMERIC)), 0)`,
  })
    .from(investimentos)
    .leftJoin(projetos, eq(investimentos.projetoId, projetos.id))
    .groupBy(investimentos.projetoId, projetos.nome)
    .orderBy(desc(sql`SUM(CAST(${investimentos.valor} AS NUMERIC))`))
    .limit(10);

  // Total investido por destino
  const investPorDestino = await db.select({
    destinoId: investimentos.destinoId,
    destinoNome: destinosInvestimento.nome,
    total: sql<number>`COALESCE(SUM(CAST(${investimentos.valor} AS NUMERIC)), 0)`,
  })
    .from(investimentos)
    .leftJoin(destinosInvestimento, eq(investimentos.destinoId, destinosInvestimento.id))
    .groupBy(investimentos.destinoId, destinosInvestimento.nome)
    .orderBy(desc(sql`SUM(CAST(${investimentos.valor} AS NUMERIC))`));

  // Investimentos por mês (últimos 12 meses)
  const investPorMes = await db.select({
    mes: sql<string>`TO_CHAR(${investimentos.data}::date, 'YYYY-MM')`,
    total: sql<number>`COALESCE(SUM(CAST(${investimentos.valor} AS NUMERIC)), 0)`,
  })
    .from(investimentos)
    .where(sql`${investimentos.data}::date >= NOW() - INTERVAL '12 months'`)
    .groupBy(sql`TO_CHAR(${investimentos.data}::date, 'YYYY-MM')`)
    .orderBy(sql`TO_CHAR(${investimentos.data}::date, 'YYYY-MM')`);

  // Total geral
  const totalGeral = await db.select({
    total: sql<number>`COALESCE(SUM(CAST(${investimentos.valor} AS NUMERIC)), 0)`,
  }).from(investimentos);

  const totalProjetos = await db.select({ count: sql<number>`COUNT(*)` }).from(projetos);

  return {
    statusCount: statusCount.map((s) => ({ status: s.status, count: Number(s.count) })),
    investPorProjeto: investPorProjeto.map((i) => ({ ...i, total: Number(i.total) })),
    investPorDestino: investPorDestino.map((i) => ({ ...i, total: Number(i.total) })),
    investPorMes: investPorMes.map((i) => ({ mes: i.mes, total: Number(i.total) })),
    totalInvestido: Number(totalGeral[0]?.total ?? 0),
    totalProjetos: Number(totalProjetos[0]?.count ?? 0),
  };
}
