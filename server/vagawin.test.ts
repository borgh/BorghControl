import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB ─────────────────────────────────────────────────────────────────

vi.mock("./db", () => ({
  listVagas: vi.fn().mockResolvedValue([
    { id: 1, numero: "01", descricao: "Vaga coberta", status: "ativa", createdAt: new Date(), updatedAt: new Date() },
    { id: 2, numero: "02", descricao: null, status: "inativa", createdAt: new Date(), updatedAt: new Date() },
  ]),
  listVagasAtivas: vi.fn().mockResolvedValue([
    { id: 1, numero: "01", descricao: "Vaga coberta", status: "ativa", createdAt: new Date(), updatedAt: new Date() },
  ]),
  getVagaById: vi.fn().mockResolvedValue({ id: 1, numero: "01", descricao: null, status: "ativa", createdAt: new Date(), updatedAt: new Date() }),
  createVaga: vi.fn().mockResolvedValue({ insertId: 3 }),
  updateVaga: vi.fn().mockResolvedValue(undefined),
  deleteVaga: vi.fn().mockResolvedValue(undefined),
  listApartamentos: vi.fn().mockResolvedValue([
    { id: 1, numero: "101", bloco: "A", responsavel: "João", status: "participante", createdAt: new Date(), updatedAt: new Date() },
    { id: 2, numero: "202", bloco: "B", responsavel: null, status: "nao_participante", createdAt: new Date(), updatedAt: new Date() },
  ]),
  listApartamentosParticipantes: vi.fn().mockResolvedValue([
    { id: 1, numero: "101", bloco: "A", responsavel: "João", status: "participante", createdAt: new Date(), updatedAt: new Date() },
    { id: 3, numero: "301", bloco: "C", responsavel: "Maria", status: "participante", createdAt: new Date(), updatedAt: new Date() },
  ]),
  getApartamentoById: vi.fn().mockResolvedValue({ id: 1, numero: "101", bloco: "A", responsavel: "João", status: "participante", createdAt: new Date(), updatedAt: new Date() }),
  createApartamento: vi.fn().mockResolvedValue({ insertId: 4 }),
  updateApartamento: vi.fn().mockResolvedValue(undefined),
  deleteApartamento: vi.fn().mockResolvedValue(undefined),
  createSorteio: vi.fn().mockResolvedValue({ insertId: 1 }),
  listSorteios: vi.fn().mockResolvedValue([
    { id: 1, realizadoEm: new Date(), totalParticipantes: 2, totalVagas: 1, responsavelId: 1, responsavelNome: "Admin", resultado: [], createdAt: new Date() },
  ]),
  getSorteioById: vi.fn().mockResolvedValue({
    id: 1, realizadoEm: new Date(), totalParticipantes: 2, totalVagas: 1, responsavelId: 1, responsavelNome: "Admin", resultado: [], createdAt: new Date(),
  }),
  getDashboardStats: vi.fn().mockResolvedValue({
    totalVagas: 2, vagasAtivas: 1, totalApartamentos: 2, apartamentosParticipantes: 1, totalSorteios: 1, ultimosSorteios: [],
  }),
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(undefined),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createAuthContext(role: "user" | "admin" = "user"): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ─── Auth Tests ───────────────────────────────────────────────────────────────

describe("auth.logout", () => {
  it("clears session cookie and returns success", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
  });

  it("returns current user on auth.me", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user?.name).toBe("Test User");
  });
});

// ─── Vagas Tests ──────────────────────────────────────────────────────────────

describe("vagas router", () => {
  it("lists all vagas", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const vagas = await caller.vagas.list();
    expect(vagas).toHaveLength(2);
    expect(vagas[0]?.numero).toBe("01");
  });

  it("lists only active vagas", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const vagas = await caller.vagas.listAtivas();
    expect(vagas).toHaveLength(1);
    expect(vagas[0]?.status).toBe("ativa");
  });

  it("creates a new vaga", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.vagas.create({ numero: "03", status: "ativa" });
    expect(result.success).toBe(true);
  });

  it("rejects vaga creation with empty numero", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.vagas.create({ numero: "", status: "ativa" })).rejects.toThrow();
  });

  it("updates a vaga", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.vagas.update({ id: 1, numero: "01A" });
    expect(result.success).toBe(true);
  });

  it("deletes a vaga", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.vagas.delete({ id: 1 });
    expect(result.success).toBe(true);
  });

  it("toggles vaga status", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.vagas.toggleStatus({ id: 1 });
    expect(result.success).toBe(true);
  });
});

// ─── Apartamentos Tests ───────────────────────────────────────────────────────

describe("apartamentos router", () => {
  it("lists all apartamentos", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const apts = await caller.apartamentos.list();
    expect(apts).toHaveLength(2);
  });

  it("lists only participantes", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const apts = await caller.apartamentos.listParticipantes();
    expect(apts).toHaveLength(2);
    expect(apts.every((a) => a.status === "participante")).toBe(true);
  });

  it("creates a new apartamento", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.apartamentos.create({ numero: "303", bloco: "C", status: "participante" });
    expect(result.success).toBe(true);
  });

  it("rejects apartamento creation with empty numero", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.apartamentos.create({ numero: "", status: "participante" })).rejects.toThrow();
  });

  it("toggles apartamento status", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.apartamentos.toggleStatus({ id: 1 });
    expect(result.success).toBe(true);
  });
});

// ─── Sorteio Tests ────────────────────────────────────────────────────────────

describe("sorteio router", () => {
  it("returns preview with totals", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const preview = await caller.sorteio.previewSorteio();
    expect(preview.totalParticipantes).toBe(2);
    expect(preview.totalVagas).toBe(1);
    expect(preview.podeRealizar).toBe(true);
  });

  it("performs a sorteio and returns resultado", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.sorteio.realizarSorteio();
    expect(result.resultado).toBeDefined();
    expect(result.totalParticipantes).toBe(2);
    expect(result.totalVagas).toBe(1);
    // Resultado deve ter min(participantes, vagas) pares
    expect(result.resultado.length).toBe(1);
  });

  it("resultado has unique apartments and vagas", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.sorteio.realizarSorteio();
    const aptIds = result.resultado.map((r) => r.apartamentoId);
    const vagaIds = result.resultado.map((r) => r.vagaId);
    expect(new Set(aptIds).size).toBe(aptIds.length);
    expect(new Set(vagaIds).size).toBe(vagaIds.length);
  });
});

// ─── Histórico Tests ──────────────────────────────────────────────────────────

describe("historico router", () => {
  it("lists all sorteios", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const list = await caller.historico.list();
    expect(list).toHaveLength(1);
  });

  it("gets sorteio by id", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const sorteio = await caller.historico.getById({ id: 1 });
    expect(sorteio.id).toBe(1);
    expect(sorteio.responsavelNome).toBe("Admin");
  });

  it("throws NOT_FOUND for invalid id", async () => {
    const { getSorteioById } = await import("./db");
    vi.mocked(getSorteioById).mockResolvedValueOnce(undefined);
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.historico.getById({ id: 9999 })).rejects.toThrow("Sorteio não encontrado");
  });
});

// ─── Dashboard Tests ──────────────────────────────────────────────────────────

describe("dashboard router", () => {
  it("returns stats", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const stats = await caller.dashboard.stats();
    expect(stats.totalVagas).toBe(2);
    expect(stats.vagasAtivas).toBe(1);
    expect(stats.totalApartamentos).toBe(2);
    expect(stats.apartamentosParticipantes).toBe(1);
  });
});
