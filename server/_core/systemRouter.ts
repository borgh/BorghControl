import { z } from "zod";
import { APP_VERSION, BUILD_DATE } from "@shared/version";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  // Versão do código atualmente rodando no servidor (gerada pelo deploy.sh).
  // O frontend compara com a versão embutida no build que carregou e,
  // se forem diferentes, oferece um botão para atualizar.
  version: publicProcedure.query(() => ({
    version: APP_VERSION,
    buildDate: BUILD_DATE,
  })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),
});
