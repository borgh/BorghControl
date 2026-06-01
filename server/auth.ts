/**
 * VagaWin — Autenticação própria com email/senha + JWT
 * Substitui completamente o OAuth da Manus.
 */
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { Request, Response } from "express";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import type { User } from "../drizzle/schema";

export const COOKIE_NAME = "vagawin_session";
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || "vagawin-dev-secret-change-in-production";
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  userId: number;
  email: string;
  name: string;
  role: "user" | "admin";
};

// ─── JWT ─────────────────────────────────────────────────────────────────────

export async function signSession(payload: SessionPayload): Promise<string> {
  const expiresAt = Math.floor((Date.now() + ONE_YEAR_MS) / 1000);
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expiresAt)
    .sign(getSecret());
}

export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    const { userId, email, name, role } = payload as Record<string, unknown>;
    if (typeof userId !== "number" || typeof email !== "string") return null;
    return { userId: userId as number, email: email as string, name: (name as string) ?? "", role: (role as "user" | "admin") ?? "user" };
  } catch {
    return null;
  }
}

// ─── Cookie helpers ───────────────────────────────────────────────────────────

export function getCookieOptions(req: Request) {
  const isSecure = req.protocol === "https" || req.headers["x-forwarded-proto"] === "https";
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? ("none" as const) : ("lax" as const),
    path: "/",
    maxAge: ONE_YEAR_MS / 1000,
  };
}

export function setSessionCookie(req: Request, res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, getCookieOptions(req));
}

export function clearSessionCookie(req: Request, res: Response) {
  res.clearCookie(COOKIE_NAME, { ...getCookieOptions(req), maxAge: -1 });
}

export function getSessionToken(req: Request): string | undefined {
  const raw = req.headers.cookie ?? "";
  const cookies = Object.fromEntries(
    raw.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k?.trim(), v.join("=")];
    })
  );
  return cookies[COOKIE_NAME];
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

export async function authenticateRequest(req: Request): Promise<User | null> {
  const token = getSessionToken(req);
  const session = await verifySession(token);
  if (!session) return null;

  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  return result[0] ?? null;
}

// ─── Register / Login ─────────────────────────────────────────────────────────

export async function registerUser(
  email: string,
  password: string,
  name: string
): Promise<{ user: User; token: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if email already exists
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) throw new Error("E-mail já cadastrado.");

  const passwordHash = await bcrypt.hash(password, 12);
  const openId = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  // First user becomes admin
  const allUsers = await db.select({ id: users.id }).from(users).limit(1);
  const role = allUsers.length === 0 ? "admin" : "user";

  await db.insert(users).values({
    openId,
    email,
    name,
    passwordHash,
    loginMethod: "email",
    role,
    lastSignedIn: new Date(),
  });

  const created = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = created[0]!;

  const token = await signSession({
    userId: user.id,
    email: user.email ?? "",
    name: user.name ?? "",
    role: user.role,
  });

  return { user, token };
}

export async function loginUser(
  email: string,
  password: string
): Promise<{ user: User; token: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = result[0];

  if (!user || !user.passwordHash) throw new Error("E-mail ou senha incorretos.");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error("E-mail ou senha incorretos.");

  // Update lastSignedIn
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));

  const token = await signSession({
    userId: user.id,
    email: user.email ?? "",
    name: user.name ?? "",
    role: user.role,
  });

  return { user, token };
}


