import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  json,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Vagas de Garagem ────────────────────────────────────────────────────────

export const vagas = mysqlTable("vagas", {
  id: int("id").autoincrement().primaryKey(),
  numero: varchar("numero", { length: 20 }).notNull(),
  descricao: text("descricao"),
  status: mysqlEnum("status", ["ativa", "inativa"]).default("ativa").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Vaga = typeof vagas.$inferSelect;
export type InsertVaga = typeof vagas.$inferInsert;

// ─── Apartamentos ────────────────────────────────────────────────────────────

export const apartamentos = mysqlTable("apartamentos", {
  id: int("id").autoincrement().primaryKey(),
  numero: varchar("numero", { length: 20 }).notNull(),
  bloco: varchar("bloco", { length: 20 }),
  responsavel: varchar("responsavel", { length: 120 }),
  status: mysqlEnum("status", ["participante", "nao_participante"])
    .default("participante")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Apartamento = typeof apartamentos.$inferSelect;
export type InsertApartamento = typeof apartamentos.$inferInsert;

// ─── Sorteios ────────────────────────────────────────────────────────────────

export const sorteios = mysqlTable("sorteios", {
  id: int("id").autoincrement().primaryKey(),
  realizadoEm: timestamp("realizadoEm").defaultNow().notNull(),
  totalParticipantes: int("totalParticipantes").notNull(),
  totalVagas: int("totalVagas").notNull(),
  responsavelId: int("responsavelId"),
  responsavelNome: varchar("responsavelNome", { length: 120 }),
  // JSON array of { apartamentoId, apartamentoNumero, apartamentoBloco, vagaId, vagaNumero }
  resultado: json("resultado").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Sorteio = typeof sorteios.$inferSelect;
export type InsertSorteio = typeof sorteios.$inferInsert;

export type ResultadoItem = {
  apartamentoId: number;
  apartamentoNumero: string;
  apartamentoBloco: string | null;
  apartamentoResponsavel: string | null;
  vagaId: number;
  vagaNumero: string;
  vagaDescricao: string | null;
};
