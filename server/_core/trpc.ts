import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { getUserPermissions } from "../db";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

/**
 * Cria um middleware que valida se o usuário tem a permissão especificada.
 * Admins sempre têm acesso total. Usuários comuns são verificados contra as
 * permissões salvas no banco (tabela system_config).
 */
export function permissionProcedure(permissionKey: string) {
  return t.procedure.use(
    t.middleware(async opts => {
      const { ctx, next } = opts;

      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
      }

      // Admins têm acesso total — sem restrição
      if (ctx.user.role === 'admin') {
        return next({ ctx: { ...ctx, user: ctx.user } });
      }

      // Para usuários comuns, verificar permissão no banco
      const permissions = await getUserPermissions();
      const allowed = permissions[permissionKey] ?? false;

      if (!allowed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Você não tem permissão para realizar esta ação. (${permissionKey})`,
        });
      }

      return next({ ctx: { ...ctx, user: ctx.user } });
    }),
  );
}
