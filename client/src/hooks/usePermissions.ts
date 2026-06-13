import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

/**
 * Hook que retorna as permissões efetivas do usuário logado.
 * - Admins sempre têm todas as permissões.
 * - Usuários comuns têm as permissões salvas no banco (system_config).
 */
export function usePermissions() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data: dbPermissions, isLoading } = trpc.configuracoes.getPermissoes.useQuery(undefined, {
    enabled: !!user && !isAdmin, // só busca se for usuário comum
    staleTime: 30_000, // cache de 30s
  });

  function can(permission: string): boolean {
    if (!user) return false;
    if (isAdmin) return true; // admin tem tudo
    if (isLoading) return false; // aguarda carregar
    return dbPermissions?.[permission] ?? false;
  }

  return { can, isLoading: !isAdmin && isLoading, isAdmin };
}
