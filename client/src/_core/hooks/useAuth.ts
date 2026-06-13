import { trpc } from "@/lib/trpc";
import { useCallback } from "react";

export function useAuth() {
  const { data: user, isLoading, error } = trpc.auth.me.useQuery(undefined, { retry: false });
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
