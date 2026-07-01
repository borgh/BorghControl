import z from "zod";
import {
  listSocios, getSocio, createSocio, updateSocio, deleteSocio,
  listDestinos, createDestino, updateDestino, deleteDestino,
  listProjetos, getProjeto, createProjeto, updateProjeto, deleteProjeto,
  setProjetoSocios, listInvestimentos, createInvestimento, updateInvestimento, deleteInvestimento,
  getDashboardProjetos,
} from "./db-projetos";
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
import { executarBackup, calcularProximaExecucao } from "./backup";
import { Pool } from "pg";
import { ENV } from "./_core/env";

function getBackupPool() {
  const url = ENV.databaseUrl;
  const isInternal = url.includes(".railway.internal") || url.includes("localhost") || url.includes("127.0.0.1");
  return new Pool({ connectionString: url, ssl: isInternal ? undefined : { rejectUnauthorized: false }, max: 2 });
}

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
  projetos: router({
    listSocios: publicProcedure
      .input(z.object({ busca: z.string().optional() }).optional())
      .query(async ({ input }) => listSocios(input?.busca)),
    getSocio: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => getSocio(input.id)),
    createSocio: publicProcedure
      .input(z.object({ nome: z.string().min(1), email: z.string().optional(), telefone: z.string().optional(), documento: z.string().optional(), observacao: z.string().optional() }))
      .mutation(async ({ input }) => createSocio(input)),
    updateSocio: publicProcedure
      .input(z.object({ id: z.number(), nome: z.string().min(1).optional(), email: z.string().optional(), telefone: z.string().optional(), documento: z.string().optional(), observacao: z.string().optional() }))
      .mutation(async ({ input }) => { const { id, ...data } = input; return updateSocio(id, data); }),
    deleteSocio: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => deleteSocio(input.id)),
    listDestinos: publicProcedure.query(async () => listDestinos()),
    createDestino: publicProcedure
      .input(z.object({ nome: z.string().min(1), descricao: z.string().optional() }))
      .mutation(async ({ input }) => createDestino(input)),
    updateDestino: publicProcedure
      .input(z.object({ id: z.number(), nome: z.string().optional(), descricao: z.string().optional() }))
      .mutation(async ({ input }) => { const { id, ...data } = input; return updateDestino(id, data); }),
    deleteDestino: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => deleteDestino(input.id)),
    list: publicProcedure
      .input(z.object({ busca: z.string().optional() }).optional())
      .query(async ({ input }) => listProjetos(input?.busca)),
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => getProjeto(input.id)),
    create: publicProcedure
      .input(z.object({
        nome: z.string().min(1),
        descricao: z.string().optional(),
        dataInicio: z.string().optional(),
        status: z.enum(["em_andamento", "pendente", "aguardando_recurso", "concluido"]).default("pendente"),
        imagemUrl: z.string().optional(),
        imagemKey: z.string().optional(),
        imagemBase64: z.string().optional(),
        imagemMime: z.string().optional(),
        imagemFit: z.string().optional(),
        socioIds: z.array(z.object({ socioId: z.number(), percentual: z.number().optional() })).optional(),
      }))
      .mutation(async ({ input }) => {
        const { socioIds, imagemBase64, imagemMime, ...projetoData } = input;
        const dadosImagem = imagemBase64 ? Buffer.from(imagemBase64, "base64") : undefined;
        const projeto = await createProjeto({ ...projetoData, imagemDados: dadosImagem, imagemMime });
        if (socioIds && socioIds.length > 0) await setProjetoSocios(projeto.id, socioIds);
        const { imagemDados: _imgCreate, ...projetoSemImagem } = projeto as any;
        return projetoSemImagem;
      }),
    update: publicProcedure
      .input(z.object({
        id: z.number(),
        nome: z.string().optional(),
        descricao: z.string().optional(),
        dataInicio: z.string().optional().nullable(),
        status: z.enum(["em_andamento", "pendente", "aguardando_recurso", "concluido"]).optional(),
        imagemUrl: z.string().optional().nullable(),
        imagemKey: z.string().optional().nullable(),
        imagemBase64: z.string().optional().nullable(),
        imagemMime: z.string().optional().nullable(),
        imagemFit: z.string().optional().nullable(),
        socioIds: z.array(z.object({ socioId: z.number(), percentual: z.number().optional() })).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, socioIds, imagemBase64, imagemMime, ...data } = input;
        const dadosImagem = imagemBase64 ? Buffer.from(imagemBase64, "base64") : undefined;
        const projeto = await updateProjeto(id, { ...data, ...(dadosImagem ? { imagemDados: dadosImagem, imagemMime: imagemMime ?? undefined } : {}) });
        if (socioIds !== undefined) await setProjetoSocios(id, socioIds);
        const { imagemDados: _imgUpdate, ...projetoSemImagem2 } = projeto as any;
        return projetoSemImagem2;
      }),
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => deleteProjeto(input.id)),
    listInvestimentos: publicProcedure
      .input(z.object({ projetoId: z.number() }))
      .query(async ({ input }) => listInvestimentos(input.projetoId)),
    createInvestimento: publicProcedure
      .input(z.object({ projetoId: z.number(), valor: z.string(), data: z.string(), destinoId: z.number().optional().nullable(), socioId: z.number().optional().nullable(), descricao: z.string().optional() }))
      .mutation(async ({ input }) => createInvestimento(input)),
    updateInvestimento: publicProcedure
      .input(z.object({ id: z.number(), valor: z.string().optional(), data: z.string().optional(), destinoId: z.number().optional().nullable(), socioId: z.number().optional().nullable(), descricao: z.string().optional() }))
      .mutation(async ({ input }) => { const { id, ...data } = input; return updateInvestimento(id, data); }),
    deleteInvestimento: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => deleteInvestimento(input.id)),
    dashboard: publicProcedure.query(async () => getDashboardProjetos()),
  }),
  relatorios: router({
    dashboard: publicProcedure
      .input(z.object({ mes: z.number().min(0).max(12).optional(), ano: z.number().optional() }).optional())
      .query(async ({ input }) => getDashboardStats(input?.mes, input?.ano)),
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
  backup: router({
    // Listar agendamentos
    listarAgendamentos: protectedProcedure.query(async () => {
      const pool = getBackupPool();
      const client = await pool.connect();
      try {
        const res = await client.query(`SELECT * FROM backup_agendamentos ORDER BY id`);
        return res.rows.map((ag: any) => ({
          ...ag,
          diasSemana: ag.dias_semana ? JSON.parse(ag.dias_semana) : null,
          proximaExecucao: calcularProximaExecucao(
            ag.dias_semana ? JSON.parse(ag.dias_semana) : null,
            ag.horario
          ),
        }));
      } finally { client.release(); await pool.end(); }
    }),

    // Criar ou atualizar agendamento
    salvarAgendamento: protectedProcedure
      .input(z.object({
        id: z.number().optional(),
        ativo: z.boolean().default(true),
        diasSemana: z.array(z.number().min(0).max(6)).nullable(),
        horario: z.string().regex(/^\d{2}:\d{2}$/),
        emailDestino: z.string().email(),
        incluirSql: z.boolean().default(true),
        incluirCsv: z.boolean().default(true),
      }))
      .mutation(async ({ input }) => {
        const pool = getBackupPool();
        const client = await pool.connect();
        try {
          const diasJson = input.diasSemana && input.diasSemana.length > 0
            ? JSON.stringify(input.diasSemana) : null;
          if (input.id) {
            await client.query(
              `UPDATE backup_agendamentos SET ativo=$1, dias_semana=$2, horario=$3, email_destino=$4,
               incluir_sql=$5, incluir_csv=$6, "updatedAt"=NOW() WHERE id=$7`,
              [input.ativo, diasJson, input.horario, input.emailDestino, input.incluirSql, input.incluirCsv, input.id]
            );
          } else {
            await client.query(
              `INSERT INTO backup_agendamentos (ativo, dias_semana, horario, email_destino, incluir_sql, incluir_csv)
               VALUES ($1,$2,$3,$4,$5,$6)`,
              [input.ativo, diasJson, input.horario, input.emailDestino, input.incluirSql, input.incluirCsv]
            );
          }
          return { ok: true };
        } finally { client.release(); await pool.end(); }
      }),

    // Deletar agendamento
    deletarAgendamento: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const pool = getBackupPool();
        const client = await pool.connect();
        try {
          await client.query(`DELETE FROM backup_agendamentos WHERE id=$1`, [input.id]);
          return { ok: true };
        } finally { client.release(); await pool.end(); }
      }),

    // Executar backup manual
    executarManual: protectedProcedure
      .input(z.object({
        emailDestino: z.string().email().default("borgh@smfusion.com.br"),
        incluirSql: z.boolean().default(true),
        incluirCsv: z.boolean().default(true),
      }))
      .mutation(async ({ input }) => {
        return executarBackup(null, "manual", input.emailDestino, input.incluirSql, input.incluirCsv);
      }),

    // Listar logs
    listarLogs: protectedProcedure
      .input(z.object({ limit: z.number().default(50) }).optional())
      .query(async ({ input }) => {
        const pool = getBackupPool();
        const client = await pool.connect();
        try {
          const res = await client.query(
            `SELECT bl.*, ba.horario, ba.email_destino
             FROM backup_logs bl
             LEFT JOIN backup_agendamentos ba ON ba.id = bl.agendamento_id
             ORDER BY bl.iniciado_em DESC LIMIT $1`,
            [input?.limit ?? 50]
          );
          return res.rows;
        } finally { client.release(); await pool.end(); }
      }),

    // Status SMTP
    statusSmtp: protectedProcedure.query(async () => {
      return {
        configurado: !!(ENV.smtpHost && ENV.smtpUser && ENV.smtpPass),
        host: ENV.smtpHost || null,
        from: ENV.smtpFrom,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
