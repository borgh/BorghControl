import z from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, permissionProcedure, router } from "./_core/trpc";
import { loginUser, registerUser, COOKIE_NAME } from "./auth";
import {
  listCategorias, createCategoria, updateCategoria, deleteCategoria,
  listTransacoes, getTransacaoById, createTransacaoComRecorrencia, updateTransacao, updateTransacaoComRecorrencia, deleteTransacao,
  deleteRecorrenciaGrupo,
  getResumoMensal, getResumoAnual, getDespesasPorCategoria, getProximosVencimentos,
  getDashboardStats, getAnosDisponiveis,
  listUsers, updateUserRole, toggleUserAtivo, deleteUser, createUserByAdmin, updateUserByAdmin,
  getUserPermissions, saveUserPermissions,
} from "./db";
import { TRPCError } from "@trpc/server";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    register: publicProcedure
      .input(z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(6) }))
      .mutation(async ({ input, ctx }) => {
        const { token, user } = await registerUser(input.email, input.password, input.name);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
        return { success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
      }),
    login: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const { token, user } = await loginUser(input.email, input.password);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
        return { success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  categorias: router({
    list: publicProcedure
      .input(z.object({ tipo: z.enum(["despesa", "receita"]).optional() }).optional())
      .query(async ({ input }) => listCategorias(input?.tipo)),
    // Criar categoria: requer permissão manage_categorias
    create: permissionProcedure("manage_categorias")
      .input(z.object({ nome: z.string().min(1).max(100), tipo: z.enum(["despesa", "receita"]), cor: z.string().optional(), icone: z.string().optional() }))
      .mutation(async ({ input }) => createCategoria(input)),
    // Editar categoria: requer permissão manage_categorias
    update: permissionProcedure("manage_categorias")
      .input(z.object({ id: z.number(), nome: z.string().min(1).max(100).optional(), cor: z.string().optional(), icone: z.string().optional() }))
      .mutation(async ({ input }) => { const { id, ...data } = input; return updateCategoria(id, data); }),
    // Excluir categoria: requer permissão manage_categorias
    delete: permissionProcedure("manage_categorias")
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => { await deleteCategoria(input.id); return { success: true }; }),
  }),
  transacoes: router({
    list: publicProcedure
      .input(z.object({ mes: z.number().min(1).max(12).optional(), ano: z.number().optional(), tipo: z.enum(["despesa", "receita"]).optional(), status: z.enum(["pendente", "pago", "cancelado"]).optional(), busca: z.string().optional(), limit: z.number().optional(), offset: z.number().optional(), emitirNF: z.boolean().optional(), prioridade: z.boolean().optional() }).optional())
      .query(async ({ input }) => listTransacoes(input ?? {})),
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => getTransacaoById(input.id)),
    // Criar lançamento: requer permissão create_lancamentos
    create: permissionProcedure("create_lancamentos")
      .input(z.object({
        descricao: z.string().min(1).max(255),
        valor: z.number().positive(),
        tipo: z.enum(["despesa", "receita"]),
        status: z.enum(["pendente", "pago", "cancelado"]).optional(),
        dataVencimento: z.string().optional(),
        diaVencimento: z.number().min(1).max(31).optional(),
        vencimentoTexto: z.string().optional(),
        mes: z.number().min(1).max(12),
        ano: z.number(),
        categoriaId: z.number().optional(),
        formaPagamento: z.string().optional(),
        observacao: z.string().optional(),
        recorrente: z.boolean().optional(),
        totalParcelas: z.number().min(1).max(360).nullable().optional(),
        emitirNF: z.boolean().optional(),
        prioridade: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        return createTransacaoComRecorrencia({
          descricao: input.descricao,
          valor: String(input.valor),
          tipo: input.tipo,
          status: input.status ?? "pendente",
          dataVencimento: input.dataVencimento,
          diaVencimento: input.diaVencimento,
          vencimentoTexto: input.vencimentoTexto,
          mes: input.mes,
          ano: input.ano,
          categoriaId: input.categoriaId,
          formaPagamento: input.formaPagamento,
          observacao: input.observacao,
          recorrente: input.recorrente ?? false,
          totalParcelas: input.recorrente ? (input.totalParcelas ?? null) : undefined,
          emitirNF: input.emitirNF ?? false,
          prioridade: input.prioridade ?? false,
        });
      }),
    // Editar lançamento: requer permissão edit_lancamentos
    update: permissionProcedure("edit_lancamentos")
      .input(z.object({
        id: z.number(),
        descricao: z.string().min(1).max(255).optional(),
        valor: z.number().positive().optional(),
        tipo: z.enum(["despesa", "receita"]).optional(),
        status: z.enum(["pendente", "pago", "cancelado"]).optional(),
        dataVencimento: z.string().nullable().optional(),
        diaVencimento: z.number().min(1).max(31).nullable().optional(),
        vencimentoTexto: z.string().optional(),
        mes: z.number().min(1).max(12).optional(),
        ano: z.number().optional(),
        categoriaId: z.number().nullable().optional(),
        formaPagamento: z.string().optional(),
        observacao: z.string().optional(),
        recorrente: z.boolean().optional(),
        emitirNF: z.boolean().optional(),
        prioridade: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, valor, ...rest } = input;
        return updateTransacao(id, { ...rest, ...(valor !== undefined ? { valor: String(valor) } : {}) });
      }),
    // Editar lançamento com geração de recorrência: requer permissão edit_lancamentos
    updateComRecorrencia: permissionProcedure("edit_lancamentos")
      .input(z.object({
        id: z.number(),
        descricao: z.string().min(1).max(255),
        valor: z.number().positive(),
        tipo: z.enum(["despesa", "receita"]),
        status: z.enum(["pendente", "pago", "cancelado"]),
        dataVencimento: z.string().optional(),
        diaVencimento: z.number().min(1).max(31).optional(),
        vencimentoTexto: z.string().optional(),
        mes: z.number().min(1).max(12),
        ano: z.number(),
        categoriaId: z.number().nullable().optional(),
        formaPagamento: z.string().optional(),
        observacao: z.string().optional(),
        recorrente: z.boolean(),
        totalParcelas: z.number().min(1).max(360).nullable().optional(),
        escopo: z.enum(["apenas_este", "este_e_futuros", "todos"]).optional(),
        emitirNF: z.boolean().optional(),
        prioridade: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, valor, ...rest } = input;
        return updateTransacaoComRecorrencia(id, { ...rest, valor: String(valor) });
      }),
    // Excluir lançamento: requer permissão delete_lancamentos
    delete: permissionProcedure("delete_lancamentos")
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => { await deleteTransacao(input.id); return { success: true }; }),
    // Excluir grupo de recorrência: requer permissão delete_lancamentos
    deleteGrupo: permissionProcedure("delete_lancamentos")
      .input(z.object({
        grupoId: z.string(),
        aPartirDe: z.object({ mes: z.number(), ano: z.number() }).optional(),
      }))
      .mutation(async ({ input }) => {
        await deleteRecorrenciaGrupo(input.grupoId, input.aPartirDe);
        return { success: true };
      }),
    // Marcar como pago: requer permissão mark_paid
    marcarPago: permissionProcedure("mark_paid")
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => updateTransacao(input.id, { status: "pago" })),
    // Marcar como pendente: requer permissão mark_paid
    marcarPendente: permissionProcedure("mark_paid")
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => updateTransacao(input.id, { status: "pendente" })),
  }),
  configuracoes: router({
    // Apenas admins podem gerenciar usuários
    listUsuarios: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores" });
      return listUsers();
    }),
    criarUsuario: protectedProcedure
      .input(z.object({
        name: z.string().min(2).max(100),
        email: z.string().email(),
        password: z.string().min(6),
        role: z.enum(["admin", "user"]).default("user"),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        return createUserByAdmin(input);
      }),
    atualizarRole: protectedProcedure
      .input(z.object({ userId: z.number(), role: z.enum(["admin", "user"]) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        if (ctx.user.id === input.userId) throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode alterar seu próprio papel" });
        return updateUserRole(input.userId, input.role);
      }),
    toggleAtivo: protectedProcedure
      .input(z.object({ userId: z.number(), ativo: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        if (ctx.user.id === input.userId) throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode desativar sua própria conta" });
        return toggleUserAtivo(input.userId, input.ativo);
      }),
    excluirUsuario: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        if (ctx.user.id === input.userId) throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode excluir sua própria conta" });
        return deleteUser(input.userId);
      }),
    editarUsuario: protectedProcedure
      .input(z.object({
        userId: z.number(),
        name: z.string().min(2).max(100).optional(),
        email: z.string().email().optional(),
        password: z.string().min(6).optional(),
        role: z.enum(["admin", "user"]).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { userId, ...data } = input;
        return updateUserByAdmin(userId, data);
      }),
    // Buscar permissões atuais do perfil usuário (qualquer autenticado pode ver)
    getPermissoes: protectedProcedure.query(async () => {
      return getUserPermissions();
    }),
    // Salvar permissões do perfil usuário (apenas admins)
    salvarPermissoes: protectedProcedure
      .input(z.object({ permissions: z.record(z.string(), z.boolean()) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        await saveUserPermissions(input.permissions);
        return { success: true };
      }),
  }),
  relatorios: router({
    dashboard: publicProcedure.query(async () => getDashboardStats()),
    resumoMensal: publicProcedure
      .input(z.object({ mes: z.number().min(1).max(12), ano: z.number() }))
      .query(async ({ input }) => getResumoMensal(input.mes, input.ano)),
    resumoAnual: publicProcedure
      .input(z.object({ ano: z.number() }))
      .query(async ({ input }) => getResumoAnual(input.ano)),
    despesasPorCategoria: publicProcedure
      .input(z.object({ mes: z.number().min(1).max(12), ano: z.number() }))
      .query(async ({ input }) => getDespesasPorCategoria(input.mes, input.ano)),
    proximosVencimentos: publicProcedure
      .input(z.object({ dias: z.number().default(7) }).optional())
      .query(async ({ input }) => getProximosVencimentos(input?.dias ?? 7)),
    anosDisponiveis: publicProcedure.query(async () => getAnosDisponiveis()),
  }),
});

export type AppRouter = typeof appRouter;
