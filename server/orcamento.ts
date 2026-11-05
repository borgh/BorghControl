/**
 * BorghControl — Regra 50-30-20: Meta Financeira, Fluxo de Caixa e Score de saúde financeira
 */
import { and, eq, sql, ne } from "drizzle-orm";
import { getDb, getOrcamentoConfig } from "./db";
import { transacoes, categorias } from "../drizzle/schema";
import { percentuais, type GrupoOrcamento } from "@shared/orcamento";

function periodoWhere(mes: number, ano: number) {
  // mes = 0 → ano inteiro
  return mes === 0
    ? and(eq(transacoes.ano, ano), ne(transacoes.status, "cancelado"))
    : and(eq(transacoes.mes, mes), eq(transacoes.ano, ano), ne(transacoes.status, "cancelado"));
}

export type MetaFinanceira = {
  modo: "padrao" | "livre" | "personalizado";
  mes: number; ano: number;
  renda: number;            // receitas do período (recebidas + previstas)
  pct: { essencial: number; lazer: number; poupanca: number };
  grupos: Record<GrupoOrcamento, { real: number; meta: number; pctRenda: number; pctMeta: number }>;
  totalGasto: number;       // essencial + lazer
  sobra: number;            // renda - totalGasto
  alertas: Array<{ grupo: GrupoOrcamento; nivel: "atencao" | "estourou" | "abaixo"; pctMeta: number }>;
};

export async function getMetaFinanceira(mes: number, ano: number): Promise<MetaFinanceira | null> {
  const db = await getDb();
  if (!db) return null;
  const cfg = await getOrcamentoConfig();
  const pct = percentuais(cfg);

  const rendaRows = await db.select({ total: sql<number>`COALESCE(SUM(CAST(${transacoes.valor} AS NUMERIC)), 0)` })
    .from(transacoes).where(and(periodoWhere(mes, ano), eq(transacoes.tipo, "receita")));
  const renda = Number(rendaRows[0]?.total ?? 0);

  // Despesas por grupo (sem categoria → essencial)
  const gastoRows = await db.select({
    grupo: sql<string>`COALESCE(${categorias.grupoOrcamento}, 'essencial')`,
    total: sql<number>`COALESCE(SUM(CAST(${transacoes.valor} AS NUMERIC)), 0)`,
  }).from(transacoes)
    .leftJoin(categorias, eq(transacoes.categoriaId, categorias.id))
    .where(and(periodoWhere(mes, ano), eq(transacoes.tipo, "despesa")))
    .groupBy(sql`COALESCE(${categorias.grupoOrcamento}, 'essencial')`);
  const gasto: Record<string, number> = { essencial: 0, lazer: 0, investimento: 0 };
  for (const r of gastoRows) gasto[r.grupo in gasto ? r.grupo : "essencial"] += Number(r.total);

  // Poupança real = receitas marcadas como investidas (valor_investir) + despesas do grupo investimento
  const invRows = await db.select({ total: sql<number>`COALESCE(SUM(CAST(${transacoes.valorInvestir} AS NUMERIC)), 0)` })
    .from(transacoes).where(and(periodoWhere(mes, ano), eq(transacoes.tipo, "receita"), eq(transacoes.investido, true)));
  const investidoReceitas = Number(invRows[0]?.total ?? 0);
  const poupancaReal = investidoReceitas + gasto.investimento;

  const meta = (p: number) => Math.round(renda * p) / 100;
  const mk = (real: number, metaV: number) => ({
    real, meta: metaV,
    pctRenda: renda > 0 ? Math.round((real / renda) * 1000) / 10 : 0,
    pctMeta: metaV > 0 ? Math.round((real / metaV) * 1000) / 10 : 0,
  });
  const grupos = {
    essencial: mk(gasto.essencial, meta(pct.essencial)),
    lazer: mk(gasto.lazer, meta(pct.lazer)),
    investimento: mk(poupancaReal, meta(pct.poupanca)),
  };

  const alertas: MetaFinanceira["alertas"] = [];
  for (const g of ["essencial", "lazer"] as const) {
    if (grupos[g].meta <= 0) continue;
    if (grupos[g].pctMeta > 100) alertas.push({ grupo: g, nivel: "estourou", pctMeta: grupos[g].pctMeta });
    else if (grupos[g].pctMeta >= 80) alertas.push({ grupo: g, nivel: "atencao", pctMeta: grupos[g].pctMeta });
  }
  if (grupos.investimento.meta > 0 && grupos.investimento.pctMeta < 100) {
    alertas.push({ grupo: "investimento", nivel: "abaixo", pctMeta: grupos.investimento.pctMeta });
  }

  const totalGasto = gasto.essencial + gasto.lazer;
  return { modo: cfg.modo, mes, ano, renda, pct, grupos, totalGasto, sobra: renda - totalGasto, alertas };
}

// ─── Fluxo de caixa diário: Realizado × Projetado ───────────────────────────

export type FluxoCaixaDia = { dia: number; realizado: number; projetado: number; entradasProj: number; saidasProj: number };

export async function getFluxoCaixa(mes: number, ano: number) {
  const db = await getDb();
  if (!db) return { dias: [] as FluxoCaixaDia[], primeiroDiaNegativo: null as number | null };
  if (mes === 0) { mes = new Date().getMonth() + 1; }
  const diasNoMes = new Date(ano, mes, 0).getDate();

  // Data efetiva de vencimento (mesma regra do filtro de listagem)
  const dataEfetiva = sql<string>`COALESCE(
    ${transacoes.dataVencimento}::text,
    TO_CHAR(MAKE_DATE(${transacoes.ano}, ${transacoes.mes},
      LEAST(COALESCE(${transacoes.diaVencimento}, 1),
        EXTRACT(DAY FROM (DATE_TRUNC('month', MAKE_DATE(${transacoes.ano}, ${transacoes.mes}, 1)) + INTERVAL '1 month - 1 day'))::int)), 'YYYY-MM-DD'))`;

  const rows = await db.select({
    tipo: transacoes.tipo, status: transacoes.status, valor: transacoes.valor,
    venc: dataEfetiva, pagoEm: transacoes.pagoEm,
  }).from(transacoes).where(and(eq(transacoes.mes, mes), eq(transacoes.ano, ano), ne(transacoes.status, "cancelado")));

  const realizadoDia = new Array(diasNoMes + 1).fill(0);
  const projetadoDia = new Array(diasNoMes + 1).fill(0);
  const entradas = new Array(diasNoMes + 1).fill(0);
  const saidas = new Array(diasNoMes + 1).fill(0);
  for (const r of rows) {
    const v = Number(r.valor) * (r.tipo === "receita" ? 1 : -1);
    // Dia do vencimento (dentro do mês); vencimentos fora do mês de competência vão para o último dia
    let diaVenc = Number((r.venc ?? "").slice(8, 10)) || 1;
    const mesVenc = Number((r.venc ?? "").slice(5, 7));
    if (mesVenc !== mes) diaVenc = mesVenc < mes ? 1 : diasNoMes;
    diaVenc = Math.min(Math.max(diaVenc, 1), diasNoMes);
    projetadoDia[diaVenc] += v;
    if (r.tipo === "receita") entradas[diaVenc] += Number(r.valor); else saidas[diaVenc] += Number(r.valor);
    if (r.status === "pago") {
      // Realizado: no dia em que foi pago (se foi neste mês), senão no vencimento
      let d = diaVenc;
      if (r.pagoEm) {
        const p = new Date(r.pagoEm);
        if (p.getFullYear() === ano && p.getMonth() + 1 === mes) d = p.getDate();
      }
      realizadoDia[d] += v;
    }
  }
  const dias: FluxoCaixaDia[] = [];
  let accR = 0, accP = 0, primeiroDiaNegativo: number | null = null;
  for (let d = 1; d <= diasNoMes; d++) {
    accR += realizadoDia[d]; accP += projetadoDia[d];
    if (primeiroDiaNegativo === null && accP < 0) primeiroDiaNegativo = d;
    dias.push({ dia: d, realizado: Math.round(accR * 100) / 100, projetado: Math.round(accP * 100) / 100, entradasProj: entradas[d], saidasProj: saidas[d] });
  }
  return { dias, primeiroDiaNegativo };
}

// ─── Score de saúde financeira (0–100) ──────────────────────────────────────

export async function getScoreSaude(mes: number, ano: number) {
  const db = await getDb();
  if (!db) return null;
  const meta = await getMetaFinanceira(mes, ano);
  if (!meta) return null;

  // Contas em atraso (despesas pendentes vencidas) no período
  const hoje = new Date();
  const atrasoRows = await db.select({ n: sql<number>`count(*)` }).from(transacoes).where(and(
    periodoWhere(mes, ano), eq(transacoes.tipo, "despesa"), eq(transacoes.status, "pendente"),
    sql`(${transacoes.ano} < ${hoje.getFullYear()} OR (${transacoes.ano} = ${hoje.getFullYear()} AND ${transacoes.mes} < ${hoje.getMonth() + 1})
      OR (${transacoes.ano} = ${hoje.getFullYear()} AND ${transacoes.mes} = ${hoje.getMonth() + 1} AND ${transacoes.diaVencimento} < ${hoje.getDate()}))`,
  ));
  const emAtraso = Number(atrasoRows[0]?.n ?? 0);

  const semRenda = meta.renda <= 0;
  // Fator 1 — poupança (0–40): % da meta atingida
  const fPoup = semRenda ? 0 : Math.round(Math.min(1, meta.grupos.investimento.pctMeta / 100) * 40);
  // Fator 2 — essenciais (0–30): 30 se dentro da meta; cai proporcionalmente ao excesso (0 em 150%+)
  const exc = (p: number) => Math.max(0, Math.min(1, (p - 100) / 50));
  const fEss = semRenda ? 0 : Math.round(30 * (1 - exc(meta.grupos.essencial.pctMeta)));
  // Fator 3 — lazer (0–30)
  const fLaz = semRenda ? 0 : Math.round(30 * (1 - exc(meta.grupos.lazer.pctMeta)));
  // Penalidade — atraso: -5 por conta em atraso, até -15
  const penal = Math.min(15, emAtraso * 5);
  const score = Math.max(0, Math.min(100, fPoup + fEss + fLaz - penal));
  const rotulo = score >= 75 ? "Bom controle" : score >= 50 ? "Atenção" : "Crítico";
  return {
    score, rotulo, semRenda,
    fatores: [
      { chave: "poupanca", label: "Poupança / investimentos", pontos: fPoup, max: 40, detalhe: `${Math.round(meta.grupos.investimento.pctMeta)}% da meta de ${meta.pct.poupanca}%` },
      { chave: "essencial", label: "Essenciais no limite", pontos: fEss, max: 30, detalhe: `${Math.round(meta.grupos.essencial.pctMeta)}% da meta de ${meta.pct.essencial}%` },
      { chave: "lazer", label: "Lazer no limite", pontos: fLaz, max: 30, detalhe: `${Math.round(meta.grupos.lazer.pctMeta)}% da meta de ${meta.pct.lazer}%` },
    ],
    penalidade: { pontos: penal, emAtraso },
  };
}

// ─── Lembrete do dia do salário ──────────────────────────────────────────────

/** Receitas do mês atual ainda não marcadas como investidas e o total a separar (Investir X%) */
export async function getLembreteSalario() {
  const db = await getDb();
  const cfg = await getOrcamentoConfig();
  if (!db) return { diaSalario: cfg.diaSalario, pct: percentuais(cfg).poupanca, ehHoje: false, receitas: [], totalSeparar: 0, mes: 0, ano: 0 };
  const hoje = new Date();
  const mes = hoje.getMonth() + 1, ano = hoje.getFullYear();
  const rows = await db.select({ id: transacoes.id, descricao: transacoes.descricao, valor: transacoes.valor, valorInvestir: transacoes.valorInvestir, status: transacoes.status })
    .from(transacoes)
    .where(and(eq(transacoes.mes, mes), eq(transacoes.ano, ano), eq(transacoes.tipo, "receita"), eq(transacoes.investido, false), ne(transacoes.status, "cancelado")));
  const receitas = rows.map((r) => ({ id: r.id, descricao: r.descricao, valor: Number(r.valor), valorInvestir: Number(r.valorInvestir ?? 0), recebida: r.status === "pago" }));
  const totalSeparar = receitas.reduce((s, r) => s + r.valorInvestir, 0);
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const diaRef = cfg.diaSalario ? Math.min(cfg.diaSalario, diasNoMes) : null;
  return { diaSalario: cfg.diaSalario, pct: percentuais(cfg).poupanca, ehHoje: diaRef !== null && hoje.getDate() >= diaRef, receitas, totalSeparar, mes, ano };
}

/** Marca as receitas informadas como investidas (o valor "Investir X%" foi separado) */
export async function separarPoupanca(ids: number[]) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  if (ids.length === 0) return { marcadas: 0 };
  let marcadas = 0;
  for (const id of ids) {
    const r = await db.update(transacoes).set({ investido: true, updatedAt: new Date() }).where(and(eq(transacoes.id, id), eq(transacoes.tipo, "receita"))).returning({ id: transacoes.id });
    marcadas += r.length;
  }
  return { marcadas };
}
