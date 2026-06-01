import { trpc } from "@/lib/trpc";
import { useCallback } from "react";

export function useAuth() {
  const utils = trpc.useUtils();
  const { data: user, isLoading: loading, error } = trpc.auth.me.useQuery();

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
    },
  });

  const logout = useCallback(() => {
    logoutMutation.mutate();
  }, [logoutMutation]);

  return {
    user: user ?? null,
    loading,
    error,
    isAuthenticated: !!user,
    logout,
    refresh: () => utils.auth.me.invalidate(),
  };
}
