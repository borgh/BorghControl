import { eq, and, desc, sql, ilike } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { randomUUID } from "crypto";
import { users, categorias, transacoes, systemConfig, type InsertUser, type InsertTransacao, type InsertCategoria } from "../drizzle/schema";

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
  limit?: number; offset?: number;
}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const conditions: any[] = [];
  if (params.mes) conditions.push(eq(transacoes.mes, params.mes));
  if (params.ano) conditions.push(eq(transacoes.ano, params.ano));
  if (params.tipo) conditions.push(eq(transacoes.tipo, params.tipo));
  if (params.status) conditions.push(eq(transacoes.status, params.status));
  if (params.busca) conditions.push(ilike(transacoes.descricao, `%${params.busca}%`));
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
      recorrenciaGrupoId: transacoes.recorrenciaGrupoId,
      totalParcelas: transacoes.totalParcelas, parcelaAtual: transacoes.parcelaAtual,
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
    recorrenciaGrupoId: transacoes.recorrenciaGrupoId,
    totalParcelas: transacoes.totalParcelas, parcelaAtual: transacoes.parcelaAtual,
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
 * - recorrente=true + totalParcelas=null → permanente (gera 24 meses à frente)
 * - recorrente=true + totalParcelas=N → gera N parcelas mensais
 * - recorrente=false → cria apenas uma transação
 */
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
  totalParcelas?: number | null; // null = permanente, N = parcelas
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
      recorrenciaGrupoId: null,
      totalParcelas: null,
      parcelaAtual: null,
    }).returning();
    return { created: result, grupoId: null };
  }

  // Recorrente: gerar série de parcelas
  const grupoId = randomUUID();
  const mesesParaGerar = data.totalParcelas == null ? 24 : data.totalParcelas;
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
      recorrenciaGrupoId: grupoId,
      totalParcelas: data.totalParcelas ?? null,
      parcelaAtual: i + 1,
    });
  }

  const result = await db.insert(transacoes).values(registros).returning();
  return { created: result, grupoId };
}

/**
 * Deleta todas as parcelas de um grupo de recorrência a partir de uma parcela específica
 */
export async function deleteRecorrenciaGrupo(grupoId: string, aPartirDe?: { mes: number; ano: number }) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  if (!aPartirDe) {
    // Deletar todas as parcelas do grupo
    await db.delete(transacoes).where(eq(transacoes.recorrenciaGrupoId, grupoId));
  } else {
    // Deletar apenas as parcelas futuras (a partir do mês/ano especificado)
    await db.delete(transacoes).where(
      and(
        eq(transacoes.recorrenciaGrupoId, grupoId),
        sql`(${transacoes.ano} > ${aPartirDe.ano} OR (${transacoes.ano} = ${aPartirDe.ano} AND ${transacoes.mes} >= ${aPartirDe.mes}))`
      )
    );
  }
}

export async function updateTransacao(id: number, data: Partial<InsertTransacao>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.update(transacoes).set({ ...data, updatedAt: new Date() }).where(eq(transacoes.id, id)).returning();
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
  escopo?: "apenas_este" | "este_e_futuros" | "todos";
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
        totalParcelas: data.totalParcelas ?? null,
        updatedAt: new Date(),
      }).where(eq(transacoes.id, t.id));
    }
    return { updated: registroAtual, created: [], grupoId: registroAtual.recorrenciaGrupoId };
  }

  // ─── ESCOPO: este_e_futuros (padrão) ─────────────────────────────────────
  // Recorrente: determinar grupoId (reutilizar existente ou criar novo)
  const grupoId = registroAtual.recorrenciaGrupoId ?? randomUUID();

  // Se já havia parcelas futuras deste grupo, deletar a partir do mês seguinte
  if (registroAtual.recorrenciaGrupoId) {
    const proximoMes = data.mes === 12 ? 1 : data.mes + 1;
    const proximoAno = data.mes === 12 ? data.ano + 1 : data.ano;
    await db.delete(transacoes).where(
      and(
        eq(transacoes.recorrenciaGrupoId, registroAtual.recorrenciaGrupoId),
        sql`(${transacoes.ano} > ${data.ano} OR (${transacoes.ano} = ${data.ano} AND ${transacoes.mes} > ${data.mes}))`,
        sql`${transacoes.id} != ${id}`
      )
    );
  }

  // Determinar quantos meses gerar à frente (excluindo o mês atual que já existe)
  const mesesParaGerar = data.totalParcelas == null ? 24 : (data.totalParcelas - 1);

  // Atualizar o registro atual (parcela 1)
  await db.update(transacoes).set({
    descricao: data.totalParcelas != null ? `${data.descricao} (1/${data.totalParcelas})` : data.descricao,
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
    recorrenciaGrupoId: grupoId,
    totalParcelas: data.totalParcelas ?? null,
    parcelaAtual: 1,
    updatedAt: new Date(),
  }).where(eq(transacoes.id, id));

  // Gerar parcelas futuras
  const registros: InsertTransacao[] = [];
  for (let i = 1; i <= mesesParaGerar; i++) {
    const totalMes = (data.mes - 1) + i;
    const mesParcela = (totalMes % 12) + 1;
    const anoParcela = data.ano + Math.floor(totalMes / 12);

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
        ? `${data.descricao} (${i + 1}/${data.totalParcelas})`
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
      recorrenciaGrupoId: grupoId,
      totalParcelas: data.totalParcelas ?? null,
      parcelaAtual: i + 1,
    });
  }

  let created: InsertTransacao[] = [];
  if (registros.length > 0) {
    created = await db.insert(transacoes).values(registros).returning() as any;
  }

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
  let totalReceitas = 0, totalDespesas = 0, totalPago = 0, totalPendente = 0;
  for (const row of result) {
    const v = Number(row.totalValor);
    if (row.tipo === "receita") totalReceitas += v;
    if (row.tipo === "despesa") totalDespesas += v;
    if (row.status === "pago") totalPago += v;
    if (row.status === "pendente") totalPendente += v;
  }
  return { mes, ano, totalReceitas, totalDespesas, totalPago, totalPendente, saldo: totalReceitas - totalDespesas };
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

export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return null;
  const hoje = new Date();
  const mes = hoje.getMonth() + 1;
  const ano = hoje.getFullYear();
  const [resumo, porCategoria, anuais, vencimentosDespesas, vencimentosReceitas, atrasoDespesas, atrasoReceitas] = await Promise.all([
    getResumoMensal(mes, ano),
    getDespesasPorCategoria(mes, ano),
    getResumoAnual(ano),
    getProximosVencimentos(7, "despesa"),
    getProximosVencimentos(7, "receita"),
    getLancamentosEmAtraso("despesa"),
    getLancamentosEmAtraso("receita"),
  ]);
  const totais = await db.select({
    tipo: transacoes.tipo, status: transacoes.status, count: sql<number>`COUNT(*)`,
  }).from(transacoes).where(and(eq(transacoes.mes, mes), eq(transacoes.ano, ano))).groupBy(transacoes.tipo, transacoes.status);
  let contDespesas = 0, contReceitas = 0, contPendentes = 0;
  for (const t of totais) {
    if (t.tipo === "despesa") contDespesas += Number(t.count);
    if (t.tipo === "receita") contReceitas += Number(t.count);
    if (t.status === "pendente") contPendentes += Number(t.count);
  }
  return { resumoMensal: resumo, despesasPorCategoria: porCategoria, anuais, proximosVencimentosDespesas: vencimentosDespesas, proximosVencimentosReceitas: vencimentosReceitas, atrasoDespesas, atrasoReceitas, contadores: { despesas: contDespesas, receitas: contReceitas, pendentes: contPendentes } };
}

export async function getAnosDisponiveis() {
  const db = await getDb();
  if (!db) return [new Date().getFullYear()];
  const result = await db.selectDistinct({ ano: transacoes.ano }).from(transacoes).orderBy(desc(transacoes.ano));
  return result.map((r) => r.ano);
}
