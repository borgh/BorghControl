import { useEffect, useState } from "react";
import { APP_VERSION, BUILD_DATE } from "@shared/version";
import { trpc } from "@/lib/trpc";

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // verifica a cada 5 minutos

/**
 * Compara a versão embutida neste build (carregado no navegador) com a
 * versão que o servidor está rodando agora. Se forem diferentes, significa
 * que um novo deploy aconteceu e o usuário está com uma versão antiga aberta.
 */
export function useVersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const { data } = trpc.system.version.useQuery(undefined, {
    refetchInterval: CHECK_INTERVAL_MS,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 0,
  });

  useEffect(() => {
    if (!data?.version) return;
    // "dev" nunca dispara update (ambiente local sem deploy.sh)
    if (data.version === "dev" || APP_VERSION === "dev") return;
    if (data.version !== APP_VERSION) {
      setUpdateAvailable(true);
    }
  }, [data?.version]);

  function updateNow() {
    // Força o service worker a ativar o novo cache imediatamente, se houver
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.active?.postMessage({ type: "SKIP_WAITING" }));
      });
    }
    window.location.reload();
  }

  return { updateAvailable, currentVersion: APP_VERSION, buildDate: BUILD_DATE, updateNow };
}
