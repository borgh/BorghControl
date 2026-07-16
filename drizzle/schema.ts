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
  customType,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() { return "bytea"; },
});

// ─── Enums ────────────────────────────────────────────────────────────────────
export const roleEnum = pgEnum("role", ["user", "admin"]);
export const tipoTransacaoEnum = pgEnum("tipo_transacao", ["despesa", "receita"]);
export const statusTransacaoEnum = pgEnum("status_transacao", ["pendente", "pago", "cancelado"]);
export const statusProjetoEnum = pgEnum("status_projeto", ["em_andamento", "pendente", "aguardando_recurso", "concluido"]);

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
    vencimentoTexto: varchar("vencimentoTexto", { length: 20 }),
    diaVencimento: integer("diaVencimento"),
    dataVencimento: date("dataVencimento"),
    mes: integer("mes").notNull(),
    ano: integer("ano").notNull(),
    categoriaId: integer("categoriaId"),
    formaPagamento: varchar("formaPagamento", { length: 50 }),
    observacao: text("observacao"),
    recorrente: boolean("recorrente").default(false),
    emitirNF: boolean("emitir_nf").default(false),
    prioridade: boolean("prioridade").notNull().default(false),
    recorrenciaGrupoId: varchar("recorrenciaGrupoId", { length: 64 }),
    totalParcelas: integer("totalParcelas"),
    parcelaAtual: integer("parcelaAtual"),
    pagoEm: timestamp("pago_em"),
    investido: boolean("investido").notNull().default(false),
    valorInvestir: decimal("valor_investir", { precision: 12, scale: 2 }),
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

// ─── Projetos e Investimentos ─────────────────────────────────────────────────
export const socios = pgTable("socios", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  telefone: varchar("telefone", { length: 30 }),
  documento: varchar("documento", { length: 30 }),
  observacao: text("observacao"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type Socio = typeof socios.$inferSelect;
export type InsertSocio = typeof socios.$inferInsert;

export const destinosInvestimento = pgTable("destinos_investimento", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  descricao: text("descricao"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type DestinoInvestimento = typeof destinosInvestimento.$inferSelect;
export type InsertDestinoInvestimento = typeof destinosInvestimento.$inferInsert;

export const projetos = pgTable("projetos", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  descricao: text("descricao"),
  dataInicio: date("data_inicio"),
  status: statusProjetoEnum("status").default("pendente").notNull(),
  imagemUrl: text("imagem_url"),
  imagemKey: text("imagem_key"),
  imagemDados: bytea("imagem_dados"),
  imagemMime: varchar("imagem_mime", { length: 100 }),
  imagemFit: varchar("imagem_fit", { length: 20 }).default("cover"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type Projeto = typeof projetos.$inferSelect;
export type InsertProjeto = typeof projetos.$inferInsert;

export const projetoSocios = pgTable("projeto_socios", {
  id: serial("id").primaryKey(),
  projetoId: integer("projeto_id").notNull(),
  socioId: integer("socio_id").notNull(),
  percentual: decimal("percentual", { precision: 5, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ProjetoSocio = typeof projetoSocios.$inferSelect;

export const investimentos = pgTable("investimentos", {
  id: serial("id").primaryKey(),
  projetoId: integer("projeto_id").notNull(),
  valor: decimal("valor", { precision: 12, scale: 2 }).notNull(),
  data: date("data").notNull(),
  destinoId: integer("destino_id"),
  socioId: integer("socio_id"),
  descricao: text("descricao"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type Investimento = typeof investimentos.$inferSelect;
export type InsertInvestimento = typeof investimentos.$inferInsert;

// ─── Backup ───────────────────────────────────────────────────────────────────
export const backupAgendamentos = pgTable("backup_agendamentos", {
  id: serial("id").primaryKey(),
  ativo: boolean("ativo").default(true).notNull(),
  // Dias da semana: JSON array ex: "[1,2,3,4,5]" ou null para todos os dias
  diasSemana: text("dias_semana"),
  horario: varchar("horario", { length: 5 }).default("02:00").notNull(), // HH:MM
  emailDestino: varchar("email_destino", { length: 255 }).default("borgh@smfusion.com.br").notNull(),
  incluirSql: boolean("incluir_sql").default(true).notNull(),
  incluirCsv: boolean("incluir_csv").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type BackupAgendamento = typeof backupAgendamentos.$inferSelect;
export type InsertBackupAgendamento = typeof backupAgendamentos.$inferInsert;

export const backupLogs = pgTable("backup_logs", {
  id: serial("id").primaryKey(),
  agendamentoId: integer("agendamento_id"),
  status: varchar("status", { length: 20 }).notNull(), // 'sucesso' | 'erro' | 'em_andamento'
  tipo: varchar("tipo", { length: 20 }).default("agendado").notNull(), // 'agendado' | 'manual'
  mensagem: text("mensagem"),
  detalhes: text("detalhes"), // JSON com detalhes do backup
  tamanhoSql: integer("tamanho_sql"), // bytes
  totalCsvs: integer("total_csvs"),
  emailEnviado: boolean("email_enviado").default(false),
  iniciadoEm: timestamp("iniciado_em").defaultNow().notNull(),
  finalizadoEm: timestamp("finalizado_em"),
});
export type BackupLog = typeof backupLogs.$inferSelect;
