import { eq, desc, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  vagas,
  apartamentos,
  sorteios,
  InsertVaga,
  InsertApartamento,
  InsertSorteio,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Vagas ───────────────────────────────────────────────────────────────────

export async function listVagas() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(vagas).orderBy(vagas.numero);
}

export async function getVagaById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(vagas).where(eq(vagas.id, id)).limit(1);
  return result[0];
}

export async function createVaga(data: InsertVaga) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(vagas).values(data);
  return result;
}

export async function updateVaga(id: number, data: Partial<InsertVaga>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(vagas).set(data).where(eq(vagas.id, id));
}

export async function deleteVaga(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(vagas).where(eq(vagas.id, id));
}

export async function listVagasAtivas() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(vagas).where(eq(vagas.status, "ativa")).orderBy(vagas.numero);
}

// ─── Apartamentos ─────────────────────────────────────────────────────────────

export async function listApartamentos() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(apartamentos).orderBy(apartamentos.bloco, apartamentos.numero);
}

export async function getApartamentoById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(apartamentos).where(eq(apartamentos.id, id)).limit(1);
  return result[0];
}

export async function createApartamento(data: InsertApartamento) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  return db.insert(apartamentos).values(data);
}

export async function updateApartamento(id: number, data: Partial<InsertApartamento>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(apartamentos).set(data).where(eq(apartamentos.id, id));
}

export async function deleteApartamento(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(apartamentos).where(eq(apartamentos.id, id));
}

export async function listApartamentosParticipantes() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(apartamentos)
    .where(eq(apartamentos.status, "participante"))
    .orderBy(apartamentos.bloco, apartamentos.numero);
}

// ─── Sorteios ─────────────────────────────────────────────────────────────────

export async function createSorteio(data: InsertSorteio) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(sorteios).values(data);
  return result;
}

export async function listSorteios() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sorteios).orderBy(desc(sorteios.realizadoEm));
}

export async function getSorteioById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(sorteios).where(eq(sorteios.id, id)).limit(1);
  return result[0];
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return { totalVagas: 0, vagasAtivas: 0, totalApartamentos: 0, apartamentosParticipantes: 0, totalSorteios: 0, ultimosSorteios: [] };

  const [allVagas, allApts, allSorteiosCount, ultimosSorteios] = await Promise.all([
    db.select().from(vagas),
    db.select().from(apartamentos),
    db.select().from(sorteios),
    db.select().from(sorteios).orderBy(desc(sorteios.realizadoEm)).limit(5),
  ]);

  return {
    totalVagas: allVagas.length,
    vagasAtivas: allVagas.filter((v) => v.status === "ativa").length,
    totalApartamentos: allApts.length,
    apartamentosParticipantes: allApts.filter((a) => a.status === "participante").length,
    totalSorteios: allSorteiosCount.length,
    ultimosSorteios,
  };
}
