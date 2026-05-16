import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "super_admin" | "seller" | "customer";
export type UserStatus = "active" | "pending" | "blocked";
export type StoreStatus = "pending" | "approved" | "rejected" | "disabled";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  status: UserStatus;
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  storeStatus: StoreStatus | null;
  storeId: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null, session: null, profile: null, role: null,
    storeStatus: null, storeId: null, loading: true,
  });

  const loadUserData = useCallback(async (userId: string) => {
    // Defer DB calls outside auth state callback to prevent deadlock
    const [{ data: profile }, { data: roleRow }, { data: store }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId).order("role").limit(1).maybeSingle(),
      supabase.from("stores").select("id, status").eq("seller_id", userId).maybeSingle(),
    ]);
    setState((s) => ({
      ...s,
      profile: (profile as Profile) ?? null,
      role: (roleRow?.role as AppRole) ?? null,
      storeStatus: (store?.status as StoreStatus) ?? null,
      storeId: store?.id ?? null,
      loading: false,
    }));
  }, []);

  useEffect(() => {
    // Set up listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setState((s) => ({ ...s, session, user: session?.user ?? null }));
      if (session?.user) {
        setTimeout(() => { loadUserData(session.user.id); }, 0);
      } else {
        setState((s) => ({ ...s, profile: null, role: null, storeStatus: null, storeId: null, loading: false }));
      }
    });
    // Then get existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState((s) => ({ ...s, session, user: session?.user ?? null }));
      if (session?.user) loadUserData(session.user.id);
      else setState((s) => ({ ...s, loading: false }));
    });
    return () => sub.subscription.unsubscribe();
  }, [loadUserData]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const refresh = useCallback(async () => {
    if (state.user) await loadUserData(state.user.id);
  }, [state.user, loadUserData]);

  return <AuthContext.Provider value={{ ...state, signOut, refresh }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}