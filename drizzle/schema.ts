import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  index,
  serial,
  date,
  bigint,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────
export const roleEnum = pgEnum("role", ["user", "admin"]);
export const tipoTransacaoEnum = pgEnum("tipo_transacao", ["despesa", "receita"]);
export const statusTransacaoEnum = pgEnum("status_transacao", ["pendente", "pago", "cancelado"]);

// ─── Usuários ─────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  ativo: boolean("ativo").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Categorias ───────────────────────────────────────────────────────────────
export const categorias = pgTable("categorias", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 100 }).notNull(),
  tipo: tipoTransacaoEnum("tipo").notNull(),
  cor: varchar("cor", { length: 7 }).default("#6366f1"),
  icone: varchar("icone", { length: 50 }).default("tag"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Categoria = typeof categorias.$inferSelect;
export type InsertCategoria = typeof categorias.$inferInsert;

// ─── Transações (despesas e receitas) ─────────────────────────────────────────
export const transacoes = pgTable(
  "transacoes",
  {
    id: serial("id").primaryKey(),
    descricao: varchar("descricao", { length: 255 }).notNull(),
    valor: decimal("valor", { precision: 12, scale: 2 }).notNull(),
    tipo: tipoTransacaoEnum("tipo").notNull(),
    status: statusTransacaoEnum("status").default("pendente").notNull(),
    vencimentoTexto: varchar("vencimentoTexto", { length: 20 }), // ex: "DIA 10"
    diaVencimento: integer("diaVencimento"), // número do dia 1-31
    dataVencimento: date("dataVencimento"),  // data completa YYYY-MM-DD
    mes: integer("mes").notNull(), // 1-12
    ano: integer("ano").notNull(), // ex: 2025
    categoriaId: integer("categoriaId"),
    formaPagamento: varchar("formaPagamento", { length: 50 }),
    observacao: text("observacao"),
    recorrente: boolean("recorrente").default(false),
    // Campos de controle de recorrência em série
    recorrenciaGrupoId: varchar("recorrenciaGrupoId", { length: 64 }), // UUID do grupo de parcelas
    totalParcelas: integer("totalParcelas"),   // null = permanente, N = total de parcelas
    parcelaAtual: integer("parcelaAtual"),     // 1, 2, 3... (null para não-recorrentes)
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    idxMesAno: index("idx_mes_ano").on(table.mes, table.ano),
    idxTipo: index("idx_tipo").on(table.tipo),
    idxStatus: index("idx_status").on(table.status),
    idxGrupo: index("idx_recorrencia_grupo").on(table.recorrenciaGrupoId),
  })
);

export type Transacao = typeof transacoes.$inferSelect;
export type InsertTransacao = typeof transacoes.$inferInsert;

// ─── Configurações do Sistema ─────────────────────────────────────────────────
export const systemConfig = pgTable("system_config", {
  id: serial("id").primaryKey(),
  chave: varchar("config_key", { length: 100 }).notNull().unique(),
  valor: text("config_value").notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }),
});

export type SystemConfig = typeof systemConfig.$inferSelect;
