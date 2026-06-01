import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
  json,
  serial,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const vagaStatusEnum = pgEnum("vaga_status", ["ativa", "inativa"]);
export const aptStatusEnum = pgEnum("apt_status", ["participante", "nao_participante"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Vagas de Garagem ────────────────────────────────────────────────────────

export const vagas = pgTable("vagas", {
  id: serial("id").primaryKey(),
  numero: varchar("numero", { length: 20 }).notNull(),
  descricao: text("descricao"),
  status: vagaStatusEnum("status").default("ativa").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Vaga = typeof vagas.$inferSelect;
export type InsertVaga = typeof vagas.$inferInsert;

// ─── Apartamentos ────────────────────────────────────────────────────────────

export const apartamentos = pgTable("apartamentos", {
  id: serial("id").primaryKey(),
  numero: varchar("numero", { length: 20 }).notNull(),
  bloco: varchar("bloco", { length: 20 }),
  responsavel: varchar("responsavel", { length: 120 }),
  status: aptStatusEnum("status").default("participante").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Apartamento = typeof apartamentos.$inferSelect;
export type InsertApartamento = typeof apartamentos.$inferInsert;

// ─── Sorteios ────────────────────────────────────────────────────────────────

export const sorteios = pgTable("sorteios", {
  id: serial("id").primaryKey(),
  realizadoEm: timestamp("realizadoEm").defaultNow().notNull(),
  totalParticipantes: integer("totalParticipantes").notNull(),
  totalVagas: integer("totalVagas").notNull(),
  responsavelId: integer("responsavelId"),
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
