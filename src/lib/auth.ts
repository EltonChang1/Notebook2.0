import { createClient } from "@supabase/supabase-js";
import type { Provider, Session } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isAuthConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isAuthConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export async function getCurrentSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function subscribeAuthState(
  callback: (session: Session | null) => void
): (() => void) | null {
  if (!supabase) return null;
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => subscription.unsubscribe();
}

export async function signInWithEmailPassword(email: string, password: string) {
  if (!supabase) throw new Error("Auth is not configured");
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithEmailPassword(email: string, password: string) {
  if (!supabase) throw new Error("Auth is not configured");
  return supabase.auth.signUp({ email, password });
}

export async function sendPasswordResetEmail(email: string) {
  if (!supabase) throw new Error("Auth is not configured");
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
}

export async function signInWithOAuth(provider: Provider) {
  if (!supabase) throw new Error("Auth is not configured");
  return supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: window.location.origin,
    },
  });
}

export async function signOutCurrentUser() {
  if (!supabase) return;
  await supabase.auth.signOut();
}
