/**
 * BorghControl — Séries recorrentes (parcelado / contrato com prazo / contrato indeterminado)
 *
 * Regras:
 * - Parcelado (N vezes): termina na parcela N. Não gera aviso de término.
 * - Contrato com prazo (12 ou 24 meses): termina em mesFim/anoFim. Gera aviso de término
 *   quando faltam até AVISO_DIAS dias; pode ser renovado (+12/+24) ou virar indeterminado.
 * - Contrato indeterminado: é PARA SEMPRE. O sistema mantém sempre JANELA_MESES meses
 *   gerados à frente; a rotina diária (e a inicialização do servidor) completa o que faltar.
 *   Nunca duplica: só insere mês/ano que ainda não existe no grupo.
 */
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "./db";
import { transacoes, recorrencias, type InsertTransacao, type Recorrencia } from "../drizzle/schema";

export const JANELA_MESES = 12;   // meses mantidos à frente nas séries indeterminadas
export const AVISO_DIAS = 60;     // antecedência do aviso de término de contrato

// ─── Utilitários de data ─────────────────────────────────────────────────────

/** Soma n meses a (mes, ano) — mes 1..12 */
export function somarMeses(mes: number, ano: number, n: number) {
  const total = (ano * 12 + (mes - 1)) + n;
  return { mes: (total % 12) + 1, ano: Math.floor(total / 12) };
}

/** Quantidade de meses de (a) até (b); positivo se b > a */
export function mesesEntre(a: { mes: number; ano: number }, b: { mes: number; ano: number }) {
  return (b.ano * 12 + (b.mes - 1)) - (a.ano * 12 + (a.mes - 1));
}

function ultimoDiaDoMes(mes: number, ano: number) {
  return new Date(ano, mes, 0).getDate();
}

/** Data de vencimento (YYYY-MM-DD) de um mês da série a partir do dia base */
function dataVencimentoPara(mes: number, ano: number, dia: number | null) {
  if (!dia) return null;
  const d = Math.min(dia, ultimoDiaDoMes(mes, ano));
  return `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Mês/ano "alvo" da janela: hoje + JANELA_MESES */
export function alvoJanela() {
  const hoje = new Date();
  return somarMeses(hoje.getMonth() + 1, hoje.getFullYear(), JANELA_MESES);
}

// ─── Leitura / escrita da tabela recorrencias ───────────────────────────────

export async function getRecorrencia(grupoId: string): Promise<Recorrencia | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(recorrencias).where(eq(recorrencias.grupoId, grupoId)).limit(1);
  return rows[0] ?? null;
}

export async function upsertRecorrencia(data: {
  grupoId: string;
  tipo: "parcelado" | "contrato";
  prazoMeses: number | null;
  indeterminada: boolean;
  mesFim: number | null;
  anoFim: number | null;
  avisoDispensado?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(recorrencias).values({
    grupoId: data.grupoId,
    tipo: data.tipo,
    prazoMeses: data.prazoMeses,
    indeterminada: data.indeterminada,
    mesFim: data.mesFim,
    anoFim: data.anoFim,
    avisoDispensado: data.avisoDispensado ?? false,
  }).onConflictDoUpdate({
    target: recorrencias.grupoId,
    set: {
      tipo: data.tipo,
      prazoMeses: data.prazoMeses,
      indeterminada: data.indeterminada,
      mesFim: data.mesFim,
      anoFim: data.anoFim,
      avisoDispensado: data.avisoDispensado ?? false,
      updatedAt: new Date(),
    },
  });
}

/** Último mês/ano realmente existente no grupo (fonte da verdade) */
export async function ultimoMesDoGrupo(grupoId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select({ mes: transacoes.mes, ano: transacoes.ano })
    .from(transacoes)
    .where(eq(transacoes.recorrenciaGrupoId, grupoId))
    .orderBy(desc(transacoes.ano), desc(transacoes.mes))
    .limit(1);
  return rows[0] ?? null;
}

/** Atualiza mesFim/anoFim da série a partir do que existe de fato nas transações */
export async function sincronizarFim(grupoId: string) {
  const db = await getDb();
  if (!db) return;
  const ultimo = await ultimoMesDoGrupo(grupoId);
  if (!ultimo) {
    // Série sem nenhum lançamento: remove o registro para não ficar órfão
    await db.delete(recorrencias).where(eq(recorrencias.grupoId, grupoId));
    return;
  }
  await db.update(recorrencias)
    .set({ mesFim: ultimo.mes, anoFim: ultimo.ano, updatedAt: new Date() })
    .where(eq(recorrencias.grupoId, grupoId));
}

// ─── Geração de meses ───────────────────────────────────────────────────────

/**
 * Gera os lançamentos que faltam no grupo até (ateMes, ateAno), inclusive,
 * copiando o modelo do último lançamento existente. Idempotente.
 * Retorna quantos foram criados.
 */
export async function completarAte(grupoId: string, ate: { mes: number; ano: number }): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const existentes = await db.select().from(transacoes)
    .where(eq(transacoes.recorrenciaGrupoId, grupoId))
    .orderBy(desc(transacoes.ano), desc(transacoes.mes));
  if (existentes.length === 0) return 0;

  const modelo = existentes[0]; // último lançamento = modelo
  const ultimo = { mes: modelo.mes, ano: modelo.ano };
  const faltam = mesesEntre(ultimo, ate);
  if (faltam <= 0) return 0;

  const chaves = new Set(existentes.map((t) => `${t.ano}-${t.mes}`));
  const rec = await getRecorrencia(grupoId);
  const registros: InsertTransacao[] = [];

  for (let i = 1; i <= faltam; i++) {
    const { mes, ano } = somarMeses(ultimo.mes, ultimo.ano, i);
    if (chaves.has(`${ano}-${mes}`)) continue; // nunca duplica
    const parcelaAtual = (modelo.parcelaAtual ?? 0) + i;
    registros.push({
      descricao: modelo.descricao,
      valor: modelo.valor,
      tipo: modelo.tipo,
      status: "pendente",
      dataVencimento: dataVencimentoPara(mes, ano, modelo.diaVencimento),
      diaVencimento: modelo.diaVencimento,
      vencimentoTexto: modelo.vencimentoTexto,
      mes, ano,
      categoriaId: modelo.categoriaId,
      formaPagamento: modelo.formaPagamento,
      observacao: modelo.observacao,
      recorrente: true,
      emitirNF: modelo.emitirNF ?? false,
      prioridade: modelo.prioridade ?? false,
      recorrenciaGrupoId: grupoId,
      totalParcelas: rec?.tipo === "parcelado" ? modelo.totalParcelas : null,
      parcelaAtual,
      investido: false,
    });
  }

  if (registros.length > 0) {
    await db.insert(transacoes).values(registros);
  }
  await db.update(recorrencias)
    .set({ mesFim: ate.mes, anoFim: ate.ano, updatedAt: new Date() })
    .where(eq(recorrencias.grupoId, grupoId));
  return registros.length;
}

/** Mantém a janela de JANELA_MESES meses à frente em TODAS as séries indeterminadas */
export async function manterJanelaIndeterminadas(): Promise<{ series: number; criados: number }> {
  const db = await getDb();
  if (!db) return { series: 0, criados: 0 };
  const alvo = alvoJanela();
  const series = await db.select().from(recorrencias).where(eq(recorrencias.indeterminada, true));
  let criados = 0;
  for (const s of series) {
    try {
      criados += await completarAte(s.grupoId, alvo);
    } catch (err) {
      console.error(`[Recorrências] Falha ao completar série ${s.grupoId}:`, err);
    }
  }
  if (criados > 0) console.log(`[Recorrências] Janela mantida: ${criados} lançamento(s) gerado(s) em ${series.length} série(s) indeterminada(s).`);
  return { series: series.length, criados };
}

// ─── Renovação / término ─────────────────────────────────────────────────────

/** Renova um contrato por mais N meses a partir do último mês da série */
export async function renovarRecorrencia(grupoId: string, meses: 12 | 24) {
  const rec = await getRecorrencia(grupoId);
  if (!rec) throw new Error("Série não encontrada");
  if (rec.tipo !== "contrato") throw new Error("Só contratos mensais podem ser renovados");
  const ultimo = await ultimoMesDoGrupo(grupoId);
  if (!ultimo) throw new Error("Série sem lançamentos");
  const ate = somarMeses(ultimo.mes, ultimo.ano, meses);
  const criados = await completarAte(grupoId, ate);
  const db = await getDb();
  await db!.update(recorrencias).set({
    prazoMeses: (rec.prazoMeses ?? 0) + meses,
    indeterminada: false,
    avisoDispensado: false,
    updatedAt: new Date(),
  }).where(eq(recorrencias.grupoId, grupoId));
  return { criados, fim: ate };
}

/** Transforma um contrato em indeterminado (para sempre) e já completa a janela */
export async function tornarIndeterminada(grupoId: string) {
  const rec = await getRecorrencia(grupoId);
  if (!rec) throw new Error("Série não encontrada");
  if (rec.tipo !== "contrato") throw new Error("Só contratos mensais podem ser indeterminados");
  const db = await getDb();
  await db!.update(recorrencias).set({
    indeterminada: true,
    prazoMeses: null,
    avisoDispensado: false,
    updatedAt: new Date(),
  }).where(eq(recorrencias.grupoId, grupoId));
  const criados = await completarAte(grupoId, alvoJanela());
  return { criados };
}

export async function dispensarAviso(grupoId: string) {
  const db = await getDb();
  await db!.update(recorrencias).set({ avisoDispensado: true, updatedAt: new Date() })
    .where(eq(recorrencias.grupoId, grupoId));
  return { success: true };
}

/**
 * Contratos (com prazo, não indeterminados, aviso não dispensado) cujo último mês
 * termina nos próximos `dias` dias — ou que já terminaram e ainda não foram tratados.
 */
export async function listarAvisosTermino(dias = AVISO_DIAS) {
  const db = await getDb();
  if (!db) return [];
  const series = await db.select().from(recorrencias).where(and(
    eq(recorrencias.tipo, "contrato"),
    eq(recorrencias.indeterminada, false),
    eq(recorrencias.avisoDispensado, false),
  ));
  const hoje = new Date();
  const hojeMs = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const limiteMs = hojeMs + dias * 86400000;
  const avisos: Array<{
    grupoId: string; descricao: string; valor: string; tipo: "despesa" | "receita";
    mesFim: number; anoFim: number; diasRestantes: number; diaVencimento: number | null;
  }> = [];

  for (const s of series) {
    if (!s.mesFim || !s.anoFim) continue;
    // Último lançamento da série = referência de descrição/valor
    const ult = await db.select().from(transacoes)
      .where(eq(transacoes.recorrenciaGrupoId, s.grupoId))
      .orderBy(desc(transacoes.ano), desc(transacoes.mes)).limit(1);
    const t = ult[0];
    if (!t) continue;
    const dia = t.diaVencimento ?? ultimoDiaDoMes(s.mesFim, s.anoFim);
    const fimMs = Date.UTC(s.anoFim, s.mesFim - 1, Math.min(dia, ultimoDiaDoMes(s.mesFim, s.anoFim)));
    if (fimMs > limiteMs) continue;
    avisos.push({
      grupoId: s.grupoId,
      descricao: t.descricao,
      valor: t.valor,
      tipo: t.tipo,
      mesFim: s.mesFim,
      anoFim: s.anoFim,
      diasRestantes: Math.round((fimMs - hojeMs) / 86400000),
      diaVencimento: t.diaVencimento,
    });
  }
  avisos.sort((a, b) => a.diasRestantes - b.diasRestantes);
  return avisos;
}

// ─── Rotina diária ───────────────────────────────────────────────────────────

export async function iniciarCronRecorrencias(): Promise<void> {
  // Roda na inicialização (com pequeno atraso para o DB subir) e depois a cada 24h
  setTimeout(() => { manterJanelaIndeterminadas().catch((e) => console.error("[Recorrências]", e)); }, 15 * 1000);
  setInterval(() => { manterJanelaIndeterminadas().catch((e) => console.error("[Recorrências]", e)); }, 24 * 60 * 60 * 1000);
  console.log("[Recorrências Cron] Iniciado — janela de séries indeterminadas verificada diariamente.");
}
