import { trpc } from "@/lib/trpc";
import { useCallback } from "react";

export function useAuth() {
  const { data: user, isLoading, error } = trpc.auth.me.useQuery(undefined, {
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => { window.location.href = "/login"; },
  });
  const logout = useCallback(() => logoutMutation.mutate(), [logoutMutation]);
  return {
    user: user ?? null,
    loading: isLoading,
    error,
    isAuthenticated: !!user,
    logout,
  };
}
