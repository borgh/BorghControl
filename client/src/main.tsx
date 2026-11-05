import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider, MutationCache, keepPreviousData } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";

// Atualização automática global:
// - Toda mutation bem-sucedida (criar/editar/excluir/marcar pago etc.) invalida TODAS as
//   consultas ativas — qualquer tela aberta se atualiza sozinha, inclusive telas futuras,
//   sem depender de invalidações manuais espalhadas pelo código.
// - refetchOnWindowFocus: ao voltar para a aba/app, os dados são atualizados.
// - keepPreviousData: enquanto uma consulta atualiza, a tela mantém os dados anteriores
//   (nada "pisca" vazio).
const queryClient: QueryClient = new QueryClient({
  mutationCache: new MutationCache({
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  }),
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: true,
      placeholderData: keepPreviousData,
    },
  },
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
          cache: "no-store", // nunca usa cache HTTP do navegador (crítico para o system.version funcionar)
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
