import { eq, and, or, desc, sql, ilike, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { randomUUID } from "crypto";
import { users, categorias, transacoes, systemConfig, recorrencias, type InsertUser, type InsertTransacao, type InsertCategoria } from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;

export async function getDb() {
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
      console.warn("[DB] Failed to connect:", error);
    }
  }
  return _db;
}

// ─── Gerenciamento de Usuários (Admin) ──────────────────────────────────────

// ─── Permissões do Sistema ──────────────────────────────────────────────────

export const DEFAULT_USER_PERMISSIONS: Record<string, boolean> = {
  view_dashboard: true,
  create_lancamentos: true,
  edit_lancamentos: true,
  delete_lancamentos: false,
  mark_paid: true,
  manage_categorias: true,
  view_relatorios: true,
  manage_users: false,
};

export async function getUserPermissions(): Promise<Record<string, boolean>> {
  const db = await getDb();
  if (!db) return DEFAULT_USER_PERMISSIONS;
  try {
    const rows = await db.select().from(systemConfig).where(eq(systemConfig.chave, 'user_permissions'));
    if (rows.length > 0) {
      return JSON.parse(rows[0].valor) as Record<string, boolean>;
    }
  } catch {}
  return DEFAULT_USER_PERMISSIONS;
}

export async function saveUserPermissions(permissions: Record<string, boolean>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.insert(systemConfig)
    .values({ chave: 'user_permissions', valor: JSON.stringify(permissions), updatedAt: Date.now() })
    .onConflictDoUpdate({ target: systemConfig.chave, set: { valor: JSON.stringify(permissions), updatedAt: Date.now() } });
}

export async function listUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: users.id, name: users.name, email: users.email, role: users.role,
    ativo: users.ativo, createdAt: users.createdAt, lastSignedIn: users.lastSignedIn,
  }).from(users).orderBy(users.createdAt);
}

export async function updateUserRole(userId: number, role: "admin" | "user") {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId));
  return { success: true };
}

export async function toggleUserAtivo(userId: number, ativo: boolean) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(users).set({ ativo, updatedAt: new Date() }).where(eq(users.id, userId));
  return { success: true };
}

// Preferência pessoal do menu inferior (mobile) — só afeta o próprio usuário
export async function updateBottomNavConfig(userId: number, items: string[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(users).set({ bottomNavConfig: JSON.stringify(items), updatedAt: new Date() }).where(eq(users.id, userId));
  return { success: true };
}

export async function deleteUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(users).where(eq(users.id, userId));
  return { success: true };
}

export async function createUserByAdmin(data: { name: string; email: string; password: string; role: "admin" | "user" }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const { hashPassword } = await import("./auth");
  const passwordHash = await hashPassword(data.password);
  const openId = `local_${randomUUID()}`;
  const result = await db.insert(users).values({
    openId, name: data.name, email: data.email, passwordHash,
    loginMethod: "local", role: data.role, ativo: true,
  }).returning({ id: users.id, name: users.name, email: users.email, role: users.role });
  return result[0];
}

export async function updateUserByAdmin(userId: number, data: { name?: string; email?: string; password?: string; role?: "admin" | "user" }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.password) {
    const { hashPassword } = await import("./auth");
    updateData.passwordHash = await hashPassword(data.password);
  }
  await db.update(users).set(updateData as any).where(eq(users.id, userId));
  return { success: true };
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function upsertUser(user: InsertUser): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(users).values(user).onConflictDoUpdate({
      target: users.openId,
      set: { name: user.name, email: user.email, lastSignedIn: new Date(), updatedAt: new Date() },
    });
  } catch (err) {
    console.error("[DB] upsertUser error:", err);
    throw err;
  }
}

export async function createUser(data: InsertUser) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(users).values(data).returning();
  return result[0];
}

export async function listCategorias(tipo?: "despesa" | "receita") {
  const db = await getDb();
  if (!db) return [];
  if (tipo) return db.select().from(categorias).where(eq(categorias.tipo, tipo)).orderBy(categorias.nome);
  return db.select().from(categorias).orderBy(categorias.tipo, categorias.nome);
}

export async function createCategoria(data: InsertCategoria) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(categorias).values(data).returning();
  return result[0];
}

export async function updateCategoria(id: number, data: Partial<InsertCategoria>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.update(categorias).set(data).where(eq(categorias.id, id)).returning();
  return result[0];
}

export async function deleteCategoria(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(categorias).where(eq(categorias.id, id));
}

export async function listTransacoes(params: {
  mes?: number; ano?: number; tipo?: "despesa" | "receita";
  status?: "pendente" | "pago" | "cancelado"; busca?: string;
  limit?: number; offset?: number; emitirNF?: boolean; prioridade?: boolean;
  categoriaId?: number; dataInicio?: string; dataFim?: string;
  investido?: boolean;
}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const conditions: any[] = [];
  // A data "efetiva" de vencimento: usa dataVencimento quando preenchida, senão reconstrói
  // a partir de ano+mes+diaVencimento (lançamentos recorrentes/"Contrato" geralmente não
  // preenchem dataVencimento). Usada em TODOS os modos de filtro de data (Mês/Ano, Intervalo,
  // Hoje) para que o filtro sempre reflita o vencimento real, e não a competência (mes/ano
  // brutos) — que pode ser um mês diferente do vencimento (ex: competência Setembro,
  // vencimento 01/Outubro).
  // IMPORTANTE (performance): opera em tipo `date` nativo do Postgres, sem converter para
  // texto — comparação de datas é ~2x mais rápida que comparação de texto formatado (medido
  // com EXPLAIN ANALYZE em 30 mil linhas: 7ms vs 15ms) e evita qualquer ambiguidade de
  // ordenação lexicográfica.
  const dataEfetiva = sql`COALESCE(
    ${transacoes.dataVencimento},
    MAKE_DATE(
      ${transacoes.ano}, ${transacoes.mes},
      LEAST(
        COALESCE(${transacoes.diaVencimento}, 1),
        EXTRACT(DAY FROM (DATE_TRUNC('month', MAKE_DATE(${transacoes.ano}, ${transacoes.mes}, 1)) + INTERVAL '1 month - 1 day'))::int
      )
    )
  )`;
  // Se tiver intervalo de datas, filtra pelo intervalo; caso contrário usa mês/ano do vencimento
  if (params.dataInicio && params.dataFim) {
    conditions.push(sql`(${dataEfetiva}) >= ${params.dataInicio}::date`);
    conditions.push(sql`(${dataEfetiva}) <= ${params.dataFim}::date`);
  } else {
    if (params.mes) conditions.push(sql`EXTRACT(MONTH FROM (${dataEfetiva})) = ${params.mes}`);
    if (params.ano) conditions.push(sql`EXTRACT(YEAR FROM (${dataEfetiva})) = ${params.ano}`);
  }
  if (params.tipo) conditions.push(eq(transacoes.tipo, params.tipo));
  if (params.status) conditions.push(eq(transacoes.status, params.status));
  if (params.busca) conditions.push(ilike(transacoes.descricao, `%${params.busca}%`));
  if (params.emitirNF !== undefined) conditions.push(eq(transacoes.emitirNF, params.emitirNF));
  if (params.prioridade !== undefined) conditions.push(eq(transacoes.prioridade, params.prioridade));
  if (params.categoriaId !== undefined) conditions.push(eq(transacoes.categoriaId, params.categoriaId));
  if (params.investido !== undefined) conditions.push(eq(transacoes.investido, params.investido));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = params.limit ?? 100;
  const offset = params.offset ?? 0;
  const [items, countResult] = await Promise.all([
    db.select({
      id: transacoes.id, descricao: transacoes.descricao, valor: transacoes.valor,
      tipo: transacoes.tipo, status: transacoes.status, vencimentoTexto: transacoes.vencimentoTexto,
      diaVencimento: transacoes.diaVencimento, dataVencimento: transacoes.dataVencimento,
      mes: transacoes.mes, ano: transacoes.ano,
      categoriaId: transacoes.categoriaId, formaPagamento: transacoes.formaPagamento,
      observacao: transacoes.observacao, recorrente: transacoes.recorrente,
      emitirNF: transacoes.emitirNF,
      prioridade: transacoes.prioridade,
      recorrenciaGrupoId: transacoes.recorrenciaGrupoId,
      totalParcelas: transacoes.totalParcelas, parcelaAtual: transacoes.parcelaAtual,
      pagoEm: transacoes.pagoEm,
      investido: transacoes.investido,
      valorInvestir: transacoes.valorInvestir,
      createdAt: transacoes.createdAt, updatedAt: transacoes.updatedAt,
      categoriaNome: categorias.nome, categoriaCor: categorias.cor, categoriaIcone: categorias.icone,
    })
      .from(transacoes)
      .leftJoin(categorias, eq(transacoes.categoriaId, categorias.id))
      .where(where)
      .orderBy(transacoes.diaVencimento, transacoes.id)
      .limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(transacoes).where(where),
  ]);
  return { items, total: Number(countResult[0]?.count ?? 0) };
}

export async function getTransacaoById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select({
    id: transacoes.id, descricao: transacoes.descricao, valor: transacoes.valor,
    tipo: transacoes.tipo, status: transacoes.status, vencimentoTexto: transacoes.vencimentoTexto,
    diaVencimento: transacoes.diaVencimento, dataVencimento: transacoes.dataVencimento,
    mes: transacoes.mes, ano: transacoes.ano,
    categoriaId: transacoes.categoriaId, formaPagamento: transacoes.formaPagamento,
    observacao: transacoes.observacao, recorrente: transacoes.recorrente,
    emitirNF: transacoes.emitirNF,
    prioridade: transacoes.prioridade,
    recorrenciaGrupoId: transacoes.recorrenciaGrupoId,
    totalParcelas: transacoes.totalParcelas, parcelaAtual: transacoes.parcelaAtual,
    pagoEm: transacoes.pagoEm,
    investido: transacoes.investido,
    valorInvestir: transacoes.valorInvestir,
    createdAt: transacoes.createdAt, updatedAt: transacoes.updatedAt,
    categoriaNome: categorias.nome, categoriaCor: categorias.cor,
  })
    .from(transacoes)
    .leftJoin(categorias, eq(transacoes.categoriaId, categorias.id))
    .where(eq(transacoes.id, id)).limit(1);
  return result[0];
}

export async function createTransacao(data: InsertTransacao) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(transacoes).values(data).returning();
  return result[0];
}

/**
 * Cria uma transação com recorrência:
 * - recorrente=true + totalParcelas=N → parcelado: gera N parcelas mensais
 * - recorrente=true + totalParcelas=null → contrato mensal:
 *     - indeterminada=true → PARA SEMPRE: gera JANELA_MESES à frente e a rotina diária
 *       mantém a janela sempre completa
 *     - prazoMeses=12|24 → gera exatamente esse número de meses (aviso ao se aproximar do fim)
 * - recorrente=false → cria apenas uma transação
 */
const JANELA_MESES_INDETERMINADA = 12;

function somarMesesDb(mes: number, ano: number, n: number) {
  const total = (ano * 12 + (mes - 1)) + n;
  return { mes: (total % 12) + 1, ano: Math.floor(total / 12) };
}
function mesesEntreDb(a: { mes: number; ano: number }, b: { mes: number; ano: number }) {
  return (b.ano * 12 + (b.mes - 1)) - (a.ano * 12 + (a.mes - 1));
}
function alvoJanelaDb() {
  const hoje = new Date();
  return somarMesesDb(hoje.getMonth() + 1, hoje.getFullYear(), JANELA_MESES_INDETERMINADA);
}

async function salvarRecorrencia(data: {
  grupoId: string; tipo: "parcelado" | "contrato"; prazoMeses: number | null;
  indeterminada: boolean; mesFim: number | null; anoFim: number | null;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(recorrencias).values({ ...data, avisoDispensado: false }).onConflictDoUpdate({
    target: recorrencias.grupoId,
    set: { tipo: data.tipo, prazoMeses: data.prazoMeses, indeterminada: data.indeterminada, mesFim: data.mesFim, anoFim: data.anoFim, avisoDispensado: false, updatedAt: new Date() },
  });
}

export async function createTransacaoComRecorrencia(data: {
  descricao: string;
  valor: string;
  tipo: "despesa" | "receita";
  status: "pendente" | "pago" | "cancelado";
  dataVencimento?: string; // YYYY-MM-DD
  diaVencimento?: number;
  vencimentoTexto?: string;
  mes: number;
  ano: number;
  categoriaId?: number;
  formaPagamento?: string;
  observacao?: string;
  recorrente: boolean;
  totalParcelas?: number | null; // null = contrato mensal, N = parcelas
  prazoMeses?: 12 | 24 | null;   // contrato: prazo em meses (ignorado se indeterminada)
  indeterminada?: boolean;       // contrato: sem fim
  emitirNF?: boolean;
  prioridade?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  if (!data.recorrente) {
    // Transação única — sem recorrência
    const result = await db.insert(transacoes).values({
      descricao: data.descricao,
      valor: data.valor,
      tipo: data.tipo,
      status: data.status,
      dataVencimento: data.dataVencimento ?? null,
      diaVencimento: data.diaVencimento ?? null,
      vencimentoTexto: data.vencimentoTexto ?? null,
      mes: data.mes,
      ano: data.ano,
      categoriaId: data.categoriaId ?? null,
      formaPagamento: data.formaPagamento ?? null,
      observacao: data.observacao ?? null,
      recorrente: false,
      emitirNF: data.emitirNF ?? false,
      prioridade: data.prioridade ?? false,
      recorrenciaGrupoId: null,
      totalParcelas: null,
      parcelaAtual: null,
    }).returning();
    return { created: result, grupoId: null };
  }

  // Recorrente: gerar série de parcelas
  const grupoId = randomUUID();
  const ehParcelado = data.totalParcelas != null;
  const indeterminada = !ehParcelado && !!data.indeterminada;
  const prazoContrato = data.prazoMeses === 12 ? 12 : 24;
  let mesesParaGerar: number;
  if (ehParcelado) {
    mesesParaGerar = data.totalParcelas!;
  } else if (indeterminada) {
    // Gera até hoje+12 meses (no mínimo 1, caso o início seja no futuro)
    mesesParaGerar = Math.max(1, mesesEntreDb({ mes: data.mes, ano: data.ano }, alvoJanelaDb()) + 1);
  } else {
    mesesParaGerar = prazoContrato;
  }
  const registros: InsertTransacao[] = [];

  for (let i = 0; i < mesesParaGerar; i++) {
    // Calcular mês/ano da parcela
    const totalMes = (data.mes - 1) + i;
    const mesParcela = (totalMes % 12) + 1;
    const anoParcela = data.ano + Math.floor(totalMes / 12);

    // Calcular dataVencimento da parcela
    let dataVencimentoParcela: string | null = null;
    if (data.dataVencimento) {
      const baseDate = new Date(data.dataVencimento + "T12:00:00");
      const parcelaDate = new Date(baseDate);
      parcelaDate.setMonth(baseDate.getMonth() + i);
      // Ajustar para último dia do mês se necessário
      const ultimoDia = new Date(parcelaDate.getFullYear(), parcelaDate.getMonth() + 1, 0).getDate();
      if (parcelaDate.getDate() > ultimoDia) parcelaDate.setDate(ultimoDia);
      dataVencimentoParcela = parcelaDate.toISOString().split("T")[0];
    }

    registros.push({
      descricao: data.totalParcelas != null
        ? `${data.descricao} (${i + 1}/${data.totalParcelas})`
        : data.descricao,
      valor: data.valor,
      tipo: data.tipo,
      status: i === 0 ? data.status : "pendente",
      dataVencimento: dataVencimentoParcela,
      diaVencimento: data.diaVencimento ?? null,
      vencimentoTexto: data.vencimentoTexto ?? null,
      mes: mesParcela,
      ano: anoParcela,
      categoriaId: data.categoriaId ?? null,
      formaPagamento: data.formaPagamento ?? null,
      observacao: data.observacao ?? null,
      recorrente: true,
      emitirNF: data.emitirNF ?? false,
      prioridade: data.prioridade ?? false,
      recorrenciaGrupoId: grupoId,
      totalParcelas: data.totalParcelas ?? null,
      parcelaAtual: i + 1,
    });
  }

  const result = await db.insert(transacoes).values(registros).returning();
  const fim = somarMesesDb(data.mes, data.ano, mesesParaGerar - 1);
  await salvarRecorrencia({
    grupoId,
    tipo: ehParcelado ? "parcelado" : "contrato",
    prazoMeses: ehParcelado ? data.totalParcelas! : (indeterminada ? null : prazoContrato),
    indeterminada,
    mesFim: fim.mes,
    anoFim: fim.ano,
  });
  return { created: result, grupoId };
}

/**
 * Deleta todas as parcelas de um grupo de recorrência a partir de uma parcela específica
 */
export async function deleteRecorrenciaGrupo(grupoId: string, aPartirDe?: { mes: number; ano: number }) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  if (!aPartirDe) {
    // Deletar todas as parcelas do grupo (e o registro da série)
    await db.delete(transacoes).where(eq(transacoes.recorrenciaGrupoId, grupoId));
    await db.delete(recorrencias).where(eq(recorrencias.grupoId, grupoId));
  } else {
    // Deletar apenas as parcelas futuras (a partir do mês/ano especificado)
    await db.delete(transacoes).where(
      and(
        eq(transacoes.recorrenciaGrupoId, grupoId),
        sql`(${transacoes.ano} > ${aPartirDe.ano} OR (${transacoes.ano} = ${aPartirDe.ano} AND ${transacoes.mes} >= ${aPartirDe.mes}))`
      )
    );
    // A série passa a terminar no mês anterior. Se era indeterminada, deixa de ser —
    // senão a rotina diária regeraria exatamente o que o usuário acabou de excluir.
    const fim = somarMesesDb(aPartirDe.mes, aPartirDe.ano, -1);
    const restantes = await db.select({ n: sql<number>`count(*)` }).from(transacoes).where(eq(transacoes.recorrenciaGrupoId, grupoId));
    if (Number(restantes[0]?.n ?? 0) === 0) {
      await db.delete(recorrencias).where(eq(recorrencias.grupoId, grupoId));
    } else {
      await db.update(recorrencias).set({ mesFim: fim.mes, anoFim: fim.ano, indeterminada: false, avisoDispensado: true, updatedAt: new Date() })
        .where(eq(recorrencias.grupoId, grupoId));
    }
  }
}

export async function updateTransacao(id: number, data: Partial<InsertTransacao>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const updateData: Partial<InsertTransacao> & { pagoEm?: Date | null } = { ...data, updatedAt: new Date() };
  // Se estiver marcando como pago, registrar data/hora
  if (data.status === "pago") {
    updateData.pagoEm = new Date();
  }
  // Se estiver voltando para pendente, limpar pago_em
  if (data.status === "pendente" || data.status === "cancelado") {
    updateData.pagoEm = null;
  }
  const result = await db.update(transacoes).set(updateData as any).where(eq(transacoes.id, id)).returning();
  return result[0];
}

/**
 * Atualiza uma transação e, se recorrente, gera as parcelas futuras a partir do mês seguinte.
 * - recorrente=true + totalParcelas=null → Contrato Mensal: gera 24 meses à frente
 * - recorrente=true + totalParcelas=N → Parcelado: gera N-1 parcelas futuras (a 1ª é a própria)
 * - recorrente=false → apenas atualiza o registro
 */
export async function updateTransacaoComRecorrencia(id: number, data: {
  descricao: string;
  valor: string;
  tipo: "despesa" | "receita";
  status: "pendente" | "pago" | "cancelado";
  dataVencimento?: string;
  diaVencimento?: number;
  vencimentoTexto?: string;
  mes: number;
  ano: number;
  categoriaId?: number | null;
  formaPagamento?: string;
  observacao?: string;
  recorrente: boolean;
  totalParcelas?: number | null;
  prazoMeses?: 12 | 24 | null;   // contrato: só considerado se informado (muda o prazo da série)
  indeterminada?: boolean;       // contrato: só considerado se informado
  escopo?: "apenas_este" | "este_e_futuros" | "todos";
  emitirNF?: boolean;
  prioridade?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  // Buscar o registro atual para saber o grupoId existente
  const atual = await db.select().from(transacoes).where(eq(transacoes.id, id)).limit(1);
  const registroAtual = atual[0];
  if (!registroAtual) throw new Error("Transação não encontrada");

  const escopo = data.escopo ?? "este_e_futuros";

  if (!data.recorrente) {
    // Sem recorrência: apenas atualiza este registro e remove recorrência
    const result = await db.update(transacoes).set({
      descricao: data.descricao,
      valor: data.valor,
      tipo: data.tipo,
      status: data.status,
      dataVencimento: data.dataVencimento ?? null,
      diaVencimento: data.diaVencimento ?? null,
      vencimentoTexto: data.vencimentoTexto ?? null,
      mes: data.mes,
      ano: data.ano,
      categoriaId: data.categoriaId ?? null,
      formaPagamento: data.formaPagamento ?? null,
      observacao: data.observacao ?? null,
      recorrente: false,
      emitirNF: data.emitirNF ?? false,
      prioridade: data.prioridade ?? false,
      recorrenciaGrupoId: null,
      totalParcelas: null,
      parcelaAtual: null,
      updatedAt: new Date(),
    }).where(eq(transacoes.id, id)).returning();
    return { updated: result[0], created: [], grupoId: null };
  }

  // ─── ESCOPO: apenas_este ────────────────────────────────────────────────────
  if (escopo === "apenas_este") {
    // Atualiza somente este registro, sem tocar nos demais do grupo
    const result = await db.update(transacoes).set({
      descricao: data.descricao,
      valor: data.valor,
      tipo: data.tipo,
      status: data.status,
      dataVencimento: data.dataVencimento ?? null,
      diaVencimento: data.diaVencimento ?? null,
      vencimentoTexto: data.vencimentoTexto ?? null,
      mes: data.mes,
      ano: data.ano,
      categoriaId: data.categoriaId ?? null,
      formaPagamento: data.formaPagamento ?? null,
      observacao: data.observacao ?? null,
      recorrente: true,
      emitirNF: data.emitirNF ?? false,
      prioridade: data.prioridade ?? false,
      updatedAt: new Date(),
    }).where(eq(transacoes.id, id)).returning();
    return { updated: result[0], created: [], grupoId: registroAtual.recorrenciaGrupoId };
  }

  // ─── ESCOPO: todos ──────────────────────────────────────────────────────────
  if (escopo === "todos" && registroAtual.recorrenciaGrupoId) {
    // Atualiza todos os registros do grupo (mantém mes/ano/parcela de cada um)
    const todoGrupo = await db.select().from(transacoes)
      .where(eq(transacoes.recorrenciaGrupoId, registroAtual.recorrenciaGrupoId))
      .orderBy(transacoes.ano, transacoes.mes);

    for (const t of todoGrupo) {
      const novaDesc = data.totalParcelas != null && t.parcelaAtual != null
        ? `${data.descricao} (${t.parcelaAtual}/${data.totalParcelas})`
        : data.descricao;
      await db.update(transacoes).set({
        descricao: novaDesc,
        valor: data.valor,
        tipo: data.tipo,
        categoriaId: data.categoriaId ?? null,
        formaPagamento: data.formaPagamento ?? null,
        observacao: data.observacao ?? null,
        emitirNF: data.emitirNF ?? false,
        prioridade: data.prioridade ?? false,
        totalParcelas: data.totalParcelas ?? null,
        updatedAt: new Date(),
      }).where(eq(transacoes.id, t.id));
    }
    return { updated: registroAtual, created: [], grupoId: registroAtual.recorrenciaGrupoId };
  }

  // ─── ESCOPO: este_e_futuros (padrão) ─────────────────────────────────────
  // Recorrente: determinar grupoId (reutilizar existente ou criar novo)
  const grupoId = registroAtual.recorrenciaGrupoId ?? randomUUID();
  // IMPORTANTE: a parcela editada pode ser qualquer posição da série (não só a 1ª).
  // Preservamos a posição original dela — do contrário, editar por exemplo a parcela
  // 3/5 fazia o sistema tratá-la como se fosse a parcela 1 de um plano novo, gerando
  // parcelas extras duplicadas (2/5, 3/5, 4/5, 5/5) por cima das que já existiam.
  const parcelaAtualOriginal = registroAtual.parcelaAtual ?? 1;

  // Buscar todas as parcelas existentes do grupo, para validar o total de parcelas
  let parcelasExistentes: typeof registroAtual[] = [];
  if (registroAtual.recorrenciaGrupoId) {
    parcelasExistentes = await db.select().from(transacoes)
      .where(eq(transacoes.recorrenciaGrupoId, registroAtual.recorrenciaGrupoId));
  }
  const maiorParcelaExistente = parcelasExistentes.reduce(
    (max, t) => Math.max(max, t.parcelaAtual ?? 1),
    parcelaAtualOriginal
  );

  // Não permite reduzir o total de parcelas abaixo do que já foi criado
  if (data.totalParcelas != null && data.totalParcelas < maiorParcelaExistente) {
    throw new Error(
      `Não é possível reduzir para ${data.totalParcelas} parcela(s): já existem ${maiorParcelaExistente} parcelas criadas neste parcelamento. Exclua as parcelas extras manualmente antes de reduzir o total.`
    );
  }

  // Se já havia parcelas futuras deste grupo, deletar a partir do mês seguinte
  // (protege parcelas já PAGAS de serem apagadas por engano nesse processo)
  if (registroAtual.recorrenciaGrupoId) {
    await db.delete(transacoes).where(
      and(
        eq(transacoes.recorrenciaGrupoId, registroAtual.recorrenciaGrupoId),
        sql`(${transacoes.ano} > ${data.ano} OR (${transacoes.ano} = ${data.ano} AND ${transacoes.mes} > ${data.mes}))`,
        sql`${transacoes.id} != ${id}`,
        sql`${transacoes.status} != 'pago'`
      )
    );
  }

  // Quantas parcelas futuras faltam gerar a partir desta (relativo à posição real
  // da parcela editada — só gera parcelas NOVAS se o total foi aumentado além do
  // que já existia; se o total não mudou, gera exatamente as que faltavam antes)
  const ehParcelado = data.totalParcelas != null;
  const mesAtual = { mes: data.mes, ano: data.ano };
  // Série existente (se houver) — define prazo/indeterminada quando o modal não informa
  const serieExistente = registroAtual.recorrenciaGrupoId
    ? (await db.select().from(recorrencias).where(eq(recorrencias.grupoId, registroAtual.recorrenciaGrupoId)).limit(1))[0]
    : undefined;
  let indeterminada = false;
  let prazoContrato: number | null = null;
  let fimSerie: { mes: number; ano: number };
  let mesesParaGerar: number;
  if (ehParcelado) {
    mesesParaGerar = Math.max(0, data.totalParcelas! - parcelaAtualOriginal);
    fimSerie = somarMesesDb(data.mes, data.ano, mesesParaGerar);
  } else {
    // Contrato mensal: prazo/indeterminada vêm do modal (se informados) ou da série já salva
    if (data.indeterminada !== undefined || data.prazoMeses !== undefined) {
      indeterminada = !!data.indeterminada;
      prazoContrato = indeterminada ? null : (data.prazoMeses === 12 ? 12 : 24);
    } else if (serieExistente && serieExistente.tipo === "contrato") {
      indeterminada = serieExistente.indeterminada;
      prazoContrato = serieExistente.prazoMeses;
    } else {
      prazoContrato = 24;
    }
    if (indeterminada) {
      fimSerie = alvoJanelaDb();
      if (mesesEntreDb(mesAtual, fimSerie) < 0) fimSerie = mesAtual;
    } else if (
      serieExistente && serieExistente.tipo === "contrato" && !serieExistente.indeterminada &&
      serieExistente.mesFim && serieExistente.anoFim &&
      (data.indeterminada === undefined && data.prazoMeses === undefined)
    ) {
      // Mantém o fim da série já definido (editar não estende o contrato)
      fimSerie = { mes: serieExistente.mesFim, ano: serieExistente.anoFim };
      if (mesesEntreDb(mesAtual, fimSerie) < 0) fimSerie = mesAtual;
    } else {
      // Prazo (re)definido agora: conta a partir do 1º mês da série, se conhecido
      const primeiro = parcelasExistentes.length > 0
        ? parcelasExistentes.reduce((min, t) => (t.ano * 12 + t.mes < min.ano * 12 + min.mes ? { mes: t.mes, ano: t.ano } : min), mesAtual)
        : mesAtual;
      fimSerie = somarMesesDb(primeiro.mes, primeiro.ano, (prazoContrato ?? 24) - 1);
      if (mesesEntreDb(mesAtual, fimSerie) < 0) fimSerie = mesAtual;
    }
    mesesParaGerar = mesesEntreDb(mesAtual, fimSerie);
  }

  // Atualizar o registro atual (mantendo sua própria posição na série)
  await db.update(transacoes).set({
    descricao: data.totalParcelas != null ? `${data.descricao} (${parcelaAtualOriginal}/${data.totalParcelas})` : data.descricao,
    valor: data.valor,
    tipo: data.tipo,
    status: data.status,
    dataVencimento: data.dataVencimento ?? null,
    diaVencimento: data.diaVencimento ?? null,
    vencimentoTexto: data.vencimentoTexto ?? null,
    mes: data.mes,
    ano: data.ano,
    categoriaId: data.categoriaId ?? null,
    formaPagamento: data.formaPagamento ?? null,
    observacao: data.observacao ?? null,
    recorrente: true,
    emitirNF: data.emitirNF ?? false,
    prioridade: data.prioridade ?? false,
    recorrenciaGrupoId: grupoId,
    totalParcelas: data.totalParcelas ?? null,
    parcelaAtual: parcelaAtualOriginal,
    updatedAt: new Date(),
  }).where(eq(transacoes.id, id));

  // Gerar as parcelas futuras que ainda faltam, numeradas a partir da posição real
  const registros: InsertTransacao[] = [];
  for (let i = 1; i <= mesesParaGerar; i++) {
    const totalMes = (data.mes - 1) + i;
    const mesParcela = (totalMes % 12) + 1;
    const anoParcela = data.ano + Math.floor(totalMes / 12);
    const numeroParcela = parcelaAtualOriginal + i;

    let dataVencimentoParcela: string | null = null;
    if (data.dataVencimento) {
      const baseDate = new Date(data.dataVencimento + "T12:00:00");
      const parcelaDate = new Date(baseDate);
      parcelaDate.setMonth(baseDate.getMonth() + i);
      const ultimoDia = new Date(parcelaDate.getFullYear(), parcelaDate.getMonth() + 1, 0).getDate();
      if (parcelaDate.getDate() > ultimoDia) parcelaDate.setDate(ultimoDia);
      dataVencimentoParcela = parcelaDate.toISOString().split("T")[0];
    }

    registros.push({
      descricao: data.totalParcelas != null
        ? `${data.descricao} (${numeroParcela}/${data.totalParcelas})`
        : data.descricao,
      valor: data.valor,
      tipo: data.tipo,
      status: "pendente",
      dataVencimento: dataVencimentoParcela,
      diaVencimento: data.diaVencimento ?? null,
      vencimentoTexto: data.vencimentoTexto ?? null,
      mes: mesParcela,
      ano: anoParcela,
      categoriaId: data.categoriaId ?? null,
      formaPagamento: data.formaPagamento ?? null,
      observacao: data.observacao ?? null,
      recorrente: true,
      emitirNF: data.emitirNF ?? false,
      prioridade: data.prioridade ?? false,
      recorrenciaGrupoId: grupoId,
      totalParcelas: data.totalParcelas ?? null,
      parcelaAtual: numeroParcela,
    });
  }

  let created: InsertTransacao[] = [];
  if (registros.length > 0) {
    created = await db.insert(transacoes).values(registros).returning() as any;
  }

  // Registro da série: o fim real é o último mês que existe no grupo (parcelas pagas
  // preservadas além do fim calculado também contam)
  const ultimoReal = (await db.select({ mes: transacoes.mes, ano: transacoes.ano }).from(transacoes)
    .where(eq(transacoes.recorrenciaGrupoId, grupoId))
    .orderBy(desc(transacoes.ano), desc(transacoes.mes)).limit(1))[0] ?? fimSerie;
  await salvarRecorrencia({
    grupoId,
    tipo: ehParcelado ? "parcelado" : "contrato",
    prazoMeses: ehParcelado ? data.totalParcelas! : prazoContrato,
    indeterminada,
    mesFim: ultimoReal.mes,
    anoFim: ultimoReal.ano,
  });

  return { updated: registroAtual, created, grupoId };
}

export async function deleteTransacao(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(transacoes).where(eq(transacoes.id, id));
}

export async function getResumoMensal(mes: number, ano: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select({
    tipo: transacoes.tipo, status: transacoes.status,
    totalValor: sql<number>`COALESCE(SUM(CAST(${transacoes.valor} AS NUMERIC)), 0)`,
  }).from(transacoes).where(and(eq(transacoes.mes, mes), eq(transacoes.ano, ano))).groupBy(transacoes.tipo, transacoes.status);
  let totalReceitas = 0, totalDespesas = 0, totalPago = 0, totalPendente = 0, totalPendenteReceitas = 0;
  for (const row of result) {
    const v = Number(row.totalValor);
    if (row.tipo === "receita") totalReceitas += v;
    if (row.tipo === "despesa") totalDespesas += v;
    if (row.status === "pago") totalPago += v;
    // totalPendente: apenas DESPESAS pendentes (contas a pagar)
    if (row.tipo === "despesa" && row.status === "pendente") totalPendente += v;
    // totalPendenteReceitas: apenas RECEITAS pendentes (contas a receber)
    if (row.tipo === "receita" && row.status === "pendente") totalPendenteReceitas += v;
  }
  // Calcula total em atraso: despesas pendentes com vencimento anterior a hoje
  // Para meses futuros, totalAtraso = 0 (nada pode estar atrasado no futuro)
  const hoje = new Date();
  const diaAtual = hoje.getDate();
  const mesAtual = hoje.getMonth() + 1;
  const anoAtual = hoje.getFullYear();
  // Só há atraso se o mês filtrado for anterior ao mês atual, ou igual com dia anterior
  const mesFiltradoEhFuturo = (ano > anoAtual) || (ano === anoAtual && mes > mesAtual);
  let totalAtraso = 0;
  if (!mesFiltradoEhFuturo) {
    const atrasoResult = await db.select({
      totalValor: sql<number>`COALESCE(SUM(CAST(${transacoes.valor} AS NUMERIC)), 0)`,
    }).from(transacoes).where(and(
      eq(transacoes.mes, mes),
      eq(transacoes.ano, ano),
      eq(transacoes.tipo, "despesa"),
      eq(transacoes.status, "pendente"),
      sql`(
        (${transacoes.ano} < ${anoAtual})
        OR (${transacoes.ano} = ${anoAtual} AND ${transacoes.mes} < ${mesAtual})
        OR (${transacoes.ano} = ${anoAtual} AND ${transacoes.mes} = ${mesAtual} AND ${transacoes.diaVencimento} < ${diaAtual})
      )`,
    ));
    totalAtraso = Number(atrasoResult[0]?.totalValor ?? 0);
  }
  return { mes, ano, totalReceitas, totalDespesas, totalPago, totalPendente, totalPendenteReceitas, totalAtraso, saldo: totalReceitas - totalDespesas };
}

export async function getResumoAnual(ano: number) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({
    mes: transacoes.mes, tipo: transacoes.tipo,
    total: sql<number>`COALESCE(SUM(CAST(${transacoes.valor} AS NUMERIC)), 0)`,
  }).from(transacoes).where(eq(transacoes.ano, ano)).groupBy(transacoes.mes, transacoes.tipo).orderBy(transacoes.mes);
  const meses = Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, receitas: 0, despesas: 0, saldo: 0 }));
  for (const row of result) {
    const idx = row.mes - 1;
    if (row.tipo === "receita") meses[idx].receitas += Number(row.total);
    if (row.tipo === "despesa") meses[idx].despesas += Number(row.total);
  }
  for (const m of meses) m.saldo = m.receitas - m.despesas;
  return meses;
}

export async function getDespesasPorCategoria(mes: number, ano: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    categoriaId: transacoes.categoriaId, categoriaNome: categorias.nome, categoriaCor: categorias.cor,
    total: sql<number>`COALESCE(SUM(CAST(${transacoes.valor} AS NUMERIC)), 0)`,
  })
    .from(transacoes)
    .leftJoin(categorias, eq(transacoes.categoriaId, categorias.id))
    .where(and(eq(transacoes.mes, mes), eq(transacoes.ano, ano), eq(transacoes.tipo, "despesa")))
    .groupBy(transacoes.categoriaId, categorias.nome, categorias.cor)
    .orderBy(sql`SUM(CAST(${transacoes.valor} AS NUMERIC)) DESC`);
}

export async function getProximosVencimentos(diasAfrente = 7, tipo?: "despesa" | "receita") {
  const db = await getDb();
  if (!db) return [];
  const hoje = new Date();
  const mes = hoje.getMonth() + 1;
  const ano = hoje.getFullYear();
  const diaAtual = hoje.getDate();
  const diaLimite = diaAtual + diasAfrente;
  const conditions = [
    eq(transacoes.mes, mes), eq(transacoes.ano, ano), eq(transacoes.status, "pendente"),
    sql`${transacoes.diaVencimento} >= ${diaAtual}`,
    sql`${transacoes.diaVencimento} <= ${diaLimite}`
  ];
  if (tipo) conditions.push(eq(transacoes.tipo, tipo));
  return db.select({
    id: transacoes.id, descricao: transacoes.descricao, valor: transacoes.valor,
    tipo: transacoes.tipo, diaVencimento: transacoes.diaVencimento, vencimentoTexto: transacoes.vencimentoTexto,
    dataVencimento: transacoes.dataVencimento,
    mes: transacoes.mes, ano: transacoes.ano, status: transacoes.status,
    categoriaNome: categorias.nome, categoriaCor: categorias.cor,
  })
    .from(transacoes)
    .leftJoin(categorias, eq(transacoes.categoriaId, categorias.id))
    .where(and(...conditions))
    .orderBy(transacoes.diaVencimento).limit(15);
}

export async function getLancamentosEmAtraso(tipo?: "despesa" | "receita") {
  const db = await getDb();
  if (!db) return [];
  const hoje = new Date();
  const diaAtual = hoje.getDate();
  const mesAtual = hoje.getMonth() + 1;
  const anoAtual = hoje.getFullYear();
  // Pega pendentes: meses/anos anteriores ao atual, OU mesmo mês/ano mas dia anterior ao hoje
  const conditions = [
    eq(transacoes.status, "pendente"),
    sql`(
      (${transacoes.ano} < ${anoAtual})
      OR (${transacoes.ano} = ${anoAtual} AND ${transacoes.mes} < ${mesAtual})
      OR (${transacoes.ano} = ${anoAtual} AND ${transacoes.mes} = ${mesAtual} AND ${transacoes.diaVencimento} < ${diaAtual})
    )`,
  ];
  if (tipo) conditions.push(eq(transacoes.tipo, tipo));
  return db.select({
    id: transacoes.id, descricao: transacoes.descricao, valor: transacoes.valor,
    tipo: transacoes.tipo, diaVencimento: transacoes.diaVencimento, vencimentoTexto: transacoes.vencimentoTexto,
    dataVencimento: transacoes.dataVencimento,
    mes: transacoes.mes, ano: transacoes.ano, status: transacoes.status,
    categoriaNome: categorias.nome, categoriaCor: categorias.cor,
  })
    .from(transacoes)
    .leftJoin(categorias, eq(transacoes.categoriaId, categorias.id))
    .where(and(...conditions))
    .orderBy(desc(transacoes.ano), desc(transacoes.mes), transacoes.diaVencimento)
    .limit(20);
}

export async function getLancamentosVenceEmBreve() {
  const db = await getDb();
  if (!db) return [];
  const hoje = new Date();
  // Calcula os dias (hoje+1, hoje+2, hoje+3) como {mes, ano, dia} — exclui hoje (que já é pendente normal)
  const diasAlvo: Array<{ mes: number; ano: number; dia: number }> = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() + i);
    diasAlvo.push({ mes: d.getMonth() + 1, ano: d.getFullYear(), dia: d.getDate() });
  }
  // Usa or() do drizzle para cada combinação (ano, mes, diaVencimento)
  const diaConditions = diasAlvo.map(({ mes, ano, dia }) =>
    and(
      eq(transacoes.ano, ano),
      eq(transacoes.mes, mes),
      eq(transacoes.diaVencimento, dia)
    )
  );
  return db.select({
    id: transacoes.id, descricao: transacoes.descricao, valor: transacoes.valor,
    tipo: transacoes.tipo, diaVencimento: transacoes.diaVencimento, vencimentoTexto: transacoes.vencimentoTexto,
    dataVencimento: transacoes.dataVencimento,
    mes: transacoes.mes, ano: transacoes.ano, status: transacoes.status,
    categoriaNome: categorias.nome, categoriaCor: categorias.cor,
  })
    .from(transacoes)
    .leftJoin(categorias, eq(transacoes.categoriaId, categorias.id))
    .where(and(
      eq(transacoes.status, "pendente"),
      eq(transacoes.tipo, "despesa"),
      or(...diaConditions)
    ))
    .orderBy(transacoes.ano, transacoes.mes, transacoes.diaVencimento)
    .limit(20);
}

export async function getResumoAnualTotal(ano: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select({
    tipo: transacoes.tipo, status: transacoes.status,
    totalValor: sql<number>`COALESCE(SUM(CAST(${transacoes.valor} AS NUMERIC)), 0)`,
  }).from(transacoes).where(eq(transacoes.ano, ano)).groupBy(transacoes.tipo, transacoes.status);
  let totalReceitas = 0, totalDespesas = 0, totalPago = 0, totalPendente = 0, totalPendenteReceitas = 0;
  for (const row of result) {
    const v = Number(row.totalValor);
    if (row.tipo === "receita") totalReceitas += v;
    if (row.tipo === "despesa") totalDespesas += v;
    if (row.status === "pago") totalPago += v;
    // totalPendente: apenas DESPESAS pendentes (contas a pagar)
    if (row.tipo === "despesa" && row.status === "pendente") totalPendente += v;
    // totalPendenteReceitas: apenas RECEITAS pendentes (contas a receber)
    if (row.tipo === "receita" && row.status === "pendente") totalPendenteReceitas += v;
  }
  const hoje = new Date();
  const diaAtual = hoje.getDate();
  const mesAtual = hoje.getMonth() + 1;
  const anoAtual = hoje.getFullYear();
  // Só há atraso se o ano filtrado não for futuro
  const anoEhFuturo = ano > anoAtual;
  let totalAtraso = 0;
  if (!anoEhFuturo) {
    const atrasoResult = await db.select({
      totalValor: sql<number>`COALESCE(SUM(CAST(${transacoes.valor} AS NUMERIC)), 0)`,
    }).from(transacoes).where(and(
      eq(transacoes.ano, ano),
      eq(transacoes.tipo, "despesa"),
      eq(transacoes.status, "pendente"),
      sql`(
        (${transacoes.ano} < ${anoAtual})
        OR (${transacoes.ano} = ${anoAtual} AND ${transacoes.mes} < ${mesAtual})
        OR (${transacoes.ano} = ${anoAtual} AND ${transacoes.mes} = ${mesAtual} AND ${transacoes.diaVencimento} < ${diaAtual})
      )`,
    ));
    totalAtraso = Number(atrasoResult[0]?.totalValor ?? 0);
  }
  return { mes: 0, ano, totalReceitas, totalDespesas, totalPago, totalPendente, totalPendenteReceitas, totalAtraso, saldo: totalReceitas - totalDespesas };
}

export async function getDespesasPorCategoriaAno(ano: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    categoriaId: transacoes.categoriaId, categoriaNome: categorias.nome, categoriaCor: categorias.cor,
    total: sql<number>`COALESCE(SUM(CAST(${transacoes.valor} AS NUMERIC)), 0)`,
  })
    .from(transacoes)
    .leftJoin(categorias, eq(transacoes.categoriaId, categorias.id))
    .where(and(eq(transacoes.ano, ano), eq(transacoes.tipo, "despesa")))
    .groupBy(transacoes.categoriaId, categorias.nome, categorias.cor)
    .orderBy(sql`SUM(CAST(${transacoes.valor} AS NUMERIC)) DESC`);
}

export async function getDashboardStats(mesParam?: number, anoParam?: number) {
  const db = await getDb();
  if (!db) return null;
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  // mes=0 significa "todos os meses do ano"
  const mes = mesParam ?? (hoje.getMonth() + 1);
  const ano = anoParam ?? anoAtual;
  const todosMeses = mes === 0;

  const [resumo, porCategoria, anuais, vencimentosDespesas, vencimentosReceitas, atrasoDespesas, atrasoReceitas, venceEmBreve] = await Promise.all([
    todosMeses ? getResumoAnualTotal(ano) : getResumoMensal(mes, ano),
    todosMeses ? getDespesasPorCategoriaAno(ano) : getDespesasPorCategoria(mes, ano),
    getResumoAnual(ano),
    getProximosVencimentos(7, "despesa"),
    getProximosVencimentos(7, "receita"),
    getLancamentosEmAtraso("despesa"),
    getLancamentosEmAtraso("receita"),
    getLancamentosVenceEmBreve(),
  ]);

  const totaisWhere = todosMeses
    ? eq(transacoes.ano, ano)
    : and(eq(transacoes.mes, mes), eq(transacoes.ano, ano));
  const totais = await db.select({
    tipo: transacoes.tipo, status: transacoes.status, count: sql<number>`COUNT(*)`,
  }).from(transacoes).where(totaisWhere!).groupBy(transacoes.tipo, transacoes.status);
  let contDespesas = 0, contReceitas = 0, contPendentes = 0, contPendentesReceitas = 0;
  for (const t of totais) {
    if (t.tipo === "despesa") contDespesas += Number(t.count);
    if (t.tipo === "receita") contReceitas += Number(t.count);
    // contPendentes: apenas DESPESAS pendentes (contas a pagar)
    if (t.tipo === "despesa" && t.status === "pendente") contPendentes += Number(t.count);
    // contPendentesReceitas: apenas RECEITAS pendentes (contas a receber)
    if (t.tipo === "receita" && t.status === "pendente") contPendentesReceitas += Number(t.count);
  }

  // Total investido: soma dos valor_investir de receitas marcadas como investido=true
  const investidoWhere = todosMeses
    ? and(eq(transacoes.ano, ano), eq(transacoes.tipo, "receita"), eq(transacoes.investido, true))
    : and(eq(transacoes.mes, mes), eq(transacoes.ano, ano), eq(transacoes.tipo, "receita"), eq(transacoes.investido, true));
  const investidoResult = await db.select({
    totalInvestido: sql<number>`COALESCE(SUM(CAST(${transacoes.valorInvestir} AS NUMERIC)), 0)`,
    contInvestidos: sql<number>`COUNT(*)`,
  }).from(transacoes).where(investidoWhere!);
  const totalInvestido = Number(investidoResult[0]?.totalInvestido ?? 0);
  const contInvestidos = Number(investidoResult[0]?.contInvestidos ?? 0);

  // Saldo Pendente GERAL: soma de tudo que está pendente ATÉ o mês/ano selecionado no filtro
  // (inclui atrasados de qualquer época passada + o que vence dentro do mês/ano filtrado),
  // mas NÃO inclui lançamentos de meses futuros além do filtro selecionado.
  // "Todos os meses" (mes=0) considera o ano inteiro selecionado, sem cortar por mês.
  const cutoffMes = todosMeses ? 12 : mes;
  const pendenteGeralWhere = and(
    eq(transacoes.status, "pendente"),
    sql`(
      (${transacoes.ano} < ${ano})
      OR (${transacoes.ano} = ${ano} AND ${transacoes.mes} <= ${cutoffMes})
    )`,
  );
  const pendenteGeralResult = await db.select({
    tipo: transacoes.tipo,
    totalValor: sql<number>`COALESCE(SUM(CAST(${transacoes.valor} AS NUMERIC)), 0)`,
  }).from(transacoes).where(pendenteGeralWhere!).groupBy(transacoes.tipo);
  let totalPendenteDespesasGeral = 0, totalPendenteReceitasGeral = 0;
  for (const row of pendenteGeralResult) {
    const v = Number(row.totalValor);
    if (row.tipo === "despesa") totalPendenteDespesasGeral = v;
    if (row.tipo === "receita") totalPendenteReceitasGeral = v;
  }

  return { resumoMensal: resumo, despesasPorCategoria: porCategoria, anuais, proximosVencimentosDespesas: vencimentosDespesas, proximosVencimentosReceitas: vencimentosReceitas, atrasoDespesas, atrasoReceitas, venceEmBreve, contadores: { despesas: contDespesas, receitas: contReceitas, pendentes: contPendentes, pendentesReceitas: contPendentesReceitas }, totalInvestido, contInvestidos, totalPendenteDespesasGeral, totalPendenteReceitasGeral };
}

export async function getAnosDisponiveis() {
  const db = await getDb();
  const anoAtual = new Date().getFullYear();
  if (!db) return [anoAtual, 2025];
  const result = await db.selectDistinct({ ano: transacoes.ano }).from(transacoes).orderBy(desc(transacoes.ano));
  const anos = new Set(result.map((r) => r.ano));
  anos.add(anoAtual);
  anos.add(2025); // sempre disponível, mesmo sem lançamentos registrados nesse ano
  return Array.from(anos).sort((a, b) => b - a);
}
