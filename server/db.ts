import { eq, sql, count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  InsertUser,
  users,
  vagas,
  apartamentos,
  sorteios,
  InsertVaga,
  InsertApartamento,
  InsertSorteio,
  Vaga,
  Apartamento,
  Sorteio,
  User,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
      _db = drizzle(_pool);
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

  const existing = await db.select().from(users).where(eq(users.openId, user.openId)).limit(1);
  if (existing.length > 0) {
    const updateData: Partial<InsertUser> = { lastSignedIn: new Date(), updatedAt: new Date() };
    if (user.name !== undefined) updateData.name = user.name;
    if (user.email !== undefined) updateData.email = user.email;
    if (user.loginMethod !== undefined) updateData.loginMethod = user.loginMethod;
    if (user.role !== undefined) updateData.role = user.role;
    if (user.passwordHash !== undefined) updateData.passwordHash = user.passwordHash;
    await db.update(users).set(updateData).where(eq(users.openId, user.openId));
  } else {
    const allUsers = await db.select({ id: users.id }).from(users).limit(1);
    const role = allUsers.length === 0 && user.openId === ENV.ownerOpenId ? "admin" : (user.role ?? "user");
    await db.insert(users).values({
      ...user,
      role,
      lastSignedIn: user.lastSignedIn ?? new Date(),
      updatedAt: new Date(),
    });
  }
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

// ─── Vagas ───────────────────────────────────────────────────────────────────

export async function listVagas(): Promise<Vaga[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(vagas).orderBy(vagas.numero);
}

export async function listVagasAtivas(): Promise<Vaga[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(vagas).where(eq(vagas.status, "ativa")).orderBy(vagas.numero);
}

export async function getVagaById(id: number): Promise<Vaga | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(vagas).where(eq(vagas.id, id)).limit(1);
  return result[0];
}

export async function createVaga(data: InsertVaga): Promise<Vaga> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(vagas).values(data).returning();
  return result[0]!;
}

export async function updateVaga(id: number, data: Partial<InsertVaga>): Promise<Vaga | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.update(vagas).set({ ...data, updatedAt: new Date() }).where(eq(vagas.id, id)).returning();
  return result[0];
}

export async function deleteVaga(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(vagas).where(eq(vagas.id, id));
}

// ─── Apartamentos ─────────────────────────────────────────────────────────────

export async function listApartamentos(): Promise<Apartamento[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(apartamentos).orderBy(apartamentos.bloco, apartamentos.numero);
}

export async function listApartamentosParticipantes(): Promise<Apartamento[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(apartamentos).where(eq(apartamentos.status, "participante")).orderBy(apartamentos.bloco, apartamentos.numero);
}

export async function getApartamentoById(id: number): Promise<Apartamento | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(apartamentos).where(eq(apartamentos.id, id)).limit(1);
  return result[0];
}

export async function createApartamento(data: InsertApartamento): Promise<Apartamento> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(apartamentos).values(data).returning();
  return result[0]!;
}

export async function updateApartamento(id: number, data: Partial<InsertApartamento>): Promise<Apartamento | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.update(apartamentos).set({ ...data, updatedAt: new Date() }).where(eq(apartamentos.id, id)).returning();
  return result[0];
}

export async function deleteApartamento(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(apartamentos).where(eq(apartamentos.id, id));
}

// ─── Sorteios ─────────────────────────────────────────────────────────────────

export async function createSorteio(data: InsertSorteio): Promise<Sorteio> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(sorteios).values(data).returning();
  return result[0]!;
}

export async function listSorteios(): Promise<Sorteio[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sorteios).orderBy(sql`${sorteios.realizadoEm} DESC`);
}

export async function getSorteioById(id: number): Promise<Sorteio | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(sorteios).where(eq(sorteios.id, id)).limit(1);
  return result[0];
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return { totalVagas: 0, vagasAtivas: 0, totalApartamentos: 0, apartamentosParticipantes: 0, totalSorteios: 0 };

  const [totalVagasRes, vagasAtivasRes, totalAptRes, aptPartRes, totalSorteiosRes] = await Promise.all([
    db.select({ count: count() }).from(vagas),
    db.select({ count: count() }).from(vagas).where(eq(vagas.status, "ativa")),
    db.select({ count: count() }).from(apartamentos),
    db.select({ count: count() }).from(apartamentos).where(eq(apartamentos.status, "participante")),
    db.select({ count: count() }).from(sorteios),
  ]);

  return {
    totalVagas: Number(totalVagasRes[0]?.count ?? 0),
    vagasAtivas: Number(vagasAtivasRes[0]?.count ?? 0),
    totalApartamentos: Number(totalAptRes[0]?.count ?? 0),
    apartamentosParticipantes: Number(aptPartRes[0]?.count ?? 0),
    totalSorteios: Number(totalSorteiosRes[0]?.count ?? 0),
  };
}
