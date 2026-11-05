/**
 * BorghControl — Metas de poupança (objetivo, valor-alvo, prazo, aportes, projeção)
 */
import { eq, desc, sql, and, gte } from "drizzle-orm";
import { getDb } from "./db";
import { metas, metaAportes, transacoes } from "../drizzle/schema";

export async function listMetas() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(metas).orderBy(metas.concluida, desc(metas.createdAt));
  const somas = await db.select({ metaId: metaAportes.metaId, total: sql<number>`COALESCE(SUM(CAST(${metaAportes.valor} AS NUMERIC)), 0)`, n: sql<number>`count(*)`, ultimo: sql<string>`MAX(${metaAportes.data})` })
    .from(metaAportes).groupBy(metaAportes.metaId);
  const mapa = new Map(somas.map((s) => [s.metaId, s]));

  // Média mensal de poupança dos últimos 3 meses (receitas investidas) — usada na projeção
  const hoje = new Date();
  const ini = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1);
  const inv = await db.select({ total: sql<number>`COALESCE(SUM(CAST(${transacoes.valorInvestir} AS NUMERIC)), 0)` })
    .from(transacoes).where(and(eq(transacoes.tipo, "receita"), eq(transacoes.investido, true),
      sql`(${transacoes.ano} * 12 + ${transacoes.mes}) >= ${ini.getFullYear() * 12 + ini.getMonth() + 1}`));
  const mediaMensalInvestido = Number(inv[0]?.total ?? 0) / 3;

  return rows.map((m) => {
    const s = mapa.get(m.id);
    const guardado = Number(s?.total ?? 0);
    const alvo = Number(m.valorAlvo);
    const falta = Math.max(0, alvo - guardado);
    const pct = alvo > 0 ? Math.min(100, Math.round((guardado / alvo) * 1000) / 10) : 0;
    // Ritmo real da meta: média dos aportes por mês desde o primeiro aporte (ou média de investido geral)
    let mesesRestantesEstimados: number | null = null;
    let ritmoMensal = 0;
    if (s && Number(s.n) > 0) {
      const primeiro = (m.createdAt ?? hoje);
      const mesesDecorridos = Math.max(1, (hoje.getFullYear() - primeiro.getFullYear()) * 12 + (hoje.getMonth() - primeiro.getMonth()) + 1);
      ritmoMensal = guardado / mesesDecorridos;
    }
    if (ritmoMensal <= 0) ritmoMensal = mediaMensalInvestido;
    if (falta > 0 && ritmoMensal > 0) mesesRestantesEstimados = Math.ceil(falta / ritmoMensal);
    let previsao: string | null = null;
    if (mesesRestantesEstimados !== null) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() + mesesRestantesEstimados, 1);
      previsao = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    }
    // Necessário por mês para bater o prazo
    let necessarioMes: number | null = null;
    if (m.prazo && falta > 0) {
      const p = new Date(m.prazo + "T12:00:00");
      const meses = Math.max(1, (p.getFullYear() - hoje.getFullYear()) * 12 + (p.getMonth() - hoje.getMonth()));
      necessarioMes = Math.round((falta / meses) * 100) / 100;
    }
    return { ...m, valorAlvo: alvo, guardado, falta, pct, aportes: Number(s?.n ?? 0), ultimoAporte: s?.ultimo ?? null, ritmoMensal: Math.round(ritmoMensal * 100) / 100, mesesRestantesEstimados, previsao, necessarioMes, atrasada: !!(m.prazo && falta > 0 && new Date(m.prazo + "T12:00:00") < hoje) };
  });
}

export async function createMeta(data: { nome: string; valorAlvo: string; prazo?: string | null; cor?: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const r = await db.insert(metas).values({ nome: data.nome, valorAlvo: data.valorAlvo, prazo: data.prazo ?? null, cor: data.cor ?? "#10b981" }).returning();
  return r[0];
}

export async function updateMeta(id: number, data: { nome?: string; valorAlvo?: string; prazo?: string | null; cor?: string; concluida?: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const r = await db.update(metas).set({ ...data, updatedAt: new Date() }).where(eq(metas.id, id)).returning();
  return r[0];
}

export async function deleteMeta(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(metaAportes).where(eq(metaAportes.metaId, id));
  await db.delete(metas).where(eq(metas.id, id));
  return { success: true };
}

export async function listAportes(metaId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(metaAportes).where(eq(metaAportes.metaId, metaId)).orderBy(desc(metaAportes.data), desc(metaAportes.id));
}

export async function createAporte(data: { metaId: number; valor: string; data: string; observacao?: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const r = await db.insert(metaAportes).values({ metaId: data.metaId, valor: data.valor, data: data.data, observacao: data.observacao ?? null }).returning();
  // Marca como concluída automaticamente ao atingir o alvo
  const [m] = await db.select().from(metas).where(eq(metas.id, data.metaId));
  const [soma] = await db.select({ total: sql<number>`COALESCE(SUM(CAST(${metaAportes.valor} AS NUMERIC)), 0)` }).from(metaAportes).where(eq(metaAportes.metaId, data.metaId));
  if (m && Number(soma.total) >= Number(m.valorAlvo) && !m.concluida) {
    await db.update(metas).set({ concluida: true, updatedAt: new Date() }).where(eq(metas.id, data.metaId));
  }
  return r[0];
}

export async function deleteAporte(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(metaAportes).where(eq(metaAportes.id, id));
  return { success: true };
}
