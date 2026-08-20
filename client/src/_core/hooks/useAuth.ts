import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import { useCallback, useEffect, useMemo, useState } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = "/admin-login" } = options ?? {};
  const utils = trpc.useUtils();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasSupabaseSession, setHasSupabaseSession] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSupabaseSession(Boolean(data.session));
      setSessionChecked(true);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSupabaseSession(Boolean(session));
      utils.auth.me.invalidate();
    });
    return () => subscription.subscription.unsubscribe();
  }, [utils]);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: sessionChecked && hasSupabaseSession,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    utils.auth.me.setData(undefined, null);
    setHasSupabaseSession(false);
  }, [utils]);

  const state = useMemo(() => ({
    user: meQuery.data ?? null,
    loading: !sessionChecked || (hasSupabaseSession && meQuery.isLoading),
    error: meQuery.error ?? null,
    isAuthenticated: Boolean(meQuery.data),
  }), [meQuery.data, meQuery.error, meQuery.isLoading, sessionChecked, hasSupabaseSession]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (state.loading) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;

    window.location.href = redirectPath;
  }, [redirectOnUnauthenticated, redirectPath, state.loading, state.user]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
