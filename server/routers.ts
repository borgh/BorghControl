import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import {
  listVagas,
  getVagaById,
  createVaga,
  updateVaga,
  deleteVaga,
  listVagasAtivas,
  listApartamentos,
  getApartamentoById,
  createApartamento,
  updateApartamento,
  deleteApartamento,
  listApartamentosParticipantes,
  createSorteio,
  listSorteios,
  getSorteioById,
  getDashboardStats,
} from "./db";
import { ResultadoItem } from "../drizzle/schema";
import { TRPCError } from "@trpc/server";

// ─── Algoritmo de sorteio criptograficamente seguro ──────────────────────────

function cryptoRandom(): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0]! / (0xffffffff + 1);
}

function fisherYatesShuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(cryptoRandom() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

// ─── Routers ─────────────────────────────────────────────────────────────────

const vagasRouter = router({
  list: protectedProcedure.query(async () => {
    return listVagas();
  }),

  listAtivas: protectedProcedure.query(async () => {
    return listVagasAtivas();
  }),

  create: protectedProcedure
    .input(
      z.object({
        numero: z.string().min(1).max(20),
        descricao: z.string().max(500).optional(),
        status: z.enum(["ativa", "inativa"]).default("ativa"),
      })
    )
    .mutation(async ({ input }) => {
      await createVaga(input);
      return { success: true };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        numero: z.string().min(1).max(20).optional(),
        descricao: z.string().max(500).nullable().optional(),
        status: z.enum(["ativa", "inativa"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateVaga(id, data);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await deleteVaga(input.id);
      return { success: true };
    }),

  toggleStatus: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const vaga = await getVagaById(input.id);
      if (!vaga) throw new TRPCError({ code: "NOT_FOUND", message: "Vaga não encontrada" });
      await updateVaga(input.id, { status: vaga.status === "ativa" ? "inativa" : "ativa" });
      return { success: true };
    }),
});

const apartamentosRouter = router({
  list: protectedProcedure.query(async () => {
    return listApartamentos();
  }),

  listParticipantes: protectedProcedure.query(async () => {
    return listApartamentosParticipantes();
  }),

  create: protectedProcedure
    .input(
      z.object({
        numero: z.string().min(1).max(20),
        bloco: z.string().max(20).optional(),
        responsavel: z.string().max(120).optional(),
        status: z.enum(["participante", "nao_participante"]).default("participante"),
      })
    )
    .mutation(async ({ input }) => {
      await createApartamento(input);
      return { success: true };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        numero: z.string().min(1).max(20).optional(),
        bloco: z.string().max(20).nullable().optional(),
        responsavel: z.string().max(120).nullable().optional(),
        status: z.enum(["participante", "nao_participante"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateApartamento(id, data);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await deleteApartamento(input.id);
      return { success: true };
    }),

  toggleStatus: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const apt = await getApartamentoById(input.id);
      if (!apt) throw new TRPCError({ code: "NOT_FOUND", message: "Apartamento não encontrado" });
      await updateApartamento(input.id, {
        status: apt.status === "participante" ? "nao_participante" : "participante",
      });
      return { success: true };
    }),
});

const sorteioRouter = router({
  realizarSorteio: protectedProcedure.mutation(async ({ ctx }) => {
    const [participantes, vagasDisponiveis] = await Promise.all([
      listApartamentosParticipantes(),
      listVagasAtivas(),
    ]);

    if (participantes.length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Nenhum apartamento participante cadastrado.",
      });
    }
    if (vagasDisponiveis.length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Nenhuma vaga ativa cadastrada.",
      });
    }

    // Embaralha ambas as listas com algoritmo criptograficamente seguro
    const aptsEmbaralhados = fisherYatesShuffle(participantes);
    const vagasEmbaralhadas = fisherYatesShuffle(vagasDisponiveis);

    const pares = Math.min(aptsEmbaralhados.length, vagasEmbaralhadas.length);
    const resultado: ResultadoItem[] = [];

    for (let i = 0; i < pares; i++) {
      const apt = aptsEmbaralhados[i]!;
      const vaga = vagasEmbaralhadas[i]!;
      resultado.push({
        apartamentoId: apt.id,
        apartamentoNumero: apt.numero,
        apartamentoBloco: apt.bloco ?? null,
        apartamentoResponsavel: apt.responsavel ?? null,
        vagaId: vaga.id,
        vagaNumero: vaga.numero,
        vagaDescricao: vaga.descricao ?? null,
      });
    }

    // Ordena resultado por bloco e número do apartamento
    resultado.sort((a, b) => {
      const blocoA = a.apartamentoBloco ?? "";
      const blocoB = b.apartamentoBloco ?? "";
      if (blocoA !== blocoB) return blocoA.localeCompare(blocoB);
      return a.apartamentoNumero.localeCompare(b.apartamentoNumero, undefined, { numeric: true });
    });

    const insertResult = await createSorteio({
      totalParticipantes: participantes.length,
      totalVagas: vagasDisponiveis.length,
      responsavelId: ctx.user.id,
      responsavelNome: ctx.user.name ?? ctx.user.email ?? "Usuário",
      resultado: resultado as unknown as Record<string, unknown>[],
      realizadoEm: new Date(),
    });

    // Recupera ID inserido de forma determinística
    const insertId = (insertResult as any).insertId as number;

    return {
      id: insertId,
      resultado,
      totalParticipantes: participantes.length,
      totalVagas: vagasDisponiveis.length,
      responsavelNome: ctx.user.name ?? ctx.user.email ?? "Usuário",
      realizadoEm: new Date(),
    };
  }),

  getResultado: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const sorteio = await getSorteioById(input.id);
      if (!sorteio) throw new TRPCError({ code: "NOT_FOUND", message: "Sorteio não encontrado" });
      return sorteio;
    }),

  previewSorteio: protectedProcedure.query(async () => {
    const [participantes, vagasDisponiveis] = await Promise.all([
      listApartamentosParticipantes(),
      listVagasAtivas(),
    ]);
    return {
      totalParticipantes: participantes.length,
      totalVagas: vagasDisponiveis.length,
      podeRealizar: participantes.length > 0 && vagasDisponiveis.length > 0,
    };
  }),
});

const historicoRouter = router({
  list: protectedProcedure.query(async () => {
    return listSorteios();
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const sorteio = await getSorteioById(input.id);
      if (!sorteio) throw new TRPCError({ code: "NOT_FOUND", message: "Sorteio não encontrado" });
      return sorteio;
    }),
});

const dashboardRouter = router({
  stats: protectedProcedure.query(async () => {
    return getDashboardStats();
  }),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  vagas: vagasRouter,
  apartamentos: apartamentosRouter,
  sorteio: sorteioRouter,
  historico: historicoRouter,
  dashboard: dashboardRouter,
});

export type AppRouter = typeof appRouter;
