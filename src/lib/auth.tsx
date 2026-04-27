import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export interface Profile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  plan: string;
  weekly_chapters_used: number;
  weekly_reset_at: string;
  chapters_translated_total: number;
  preferred_target_language: string | null;
  preferred_reading_mode: string | null;
  notify_on_release: boolean;
  bio?: string | null;
  age?: number | null;
  country?: string | null;
  last_seen?: string | null;
  login_streak?: number;
  history_is_private?: boolean;
  friends_are_private?: boolean;
}

interface SignUpResult {
  error: Error | null;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, username: string) => Promise<SignUpResult>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string) => {
    const { data } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", uid)
      .maybeSingle();
    setProfile((data as Profile | null) ?? null);
  };

  // Update last_seen + login_streak (best-effort, non-blocking)
  const touchPresence = async (uid: string) => {
    try {
      const { data: existing } = await supabase
        .from("user_profiles")
        .select("last_login_date, login_streak")
        .eq("id", uid)
        .maybeSingle();
      const today = new Date().toISOString().slice(0, 10);
      const last: string | null = (existing as any)?.last_login_date ?? null;
      let streak = (existing as any)?.login_streak ?? 0;
      if (last !== today) {
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        streak = last === yesterday ? streak + 1 : 1;
        await supabase
          .from("user_profiles")
          .update({ last_seen: new Date().toISOString(), last_login_date: today, login_streak: streak })
          .eq("id", uid);
      } else {
        await supabase
          .from("user_profiles")
          .update({ last_seen: new Date().toISOString() })
          .eq("id", uid);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        const uid = newSession.user.id;
        setTimeout(() => {
          loadProfile(uid);
          touchPresence(uid);
        }, 0);
      } else {
        setProfile(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        loadProfile(s.user.id);
        touchPresence(s.user.id);
      }
      setLoading(false);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, username: string) => {
    const trimmed = username.trim();
    if (!trimmed) return { error: new Error("Username is required") };
    if (!USERNAME_RE.test(trimmed)) {
      return { error: new Error("Username must be 3–20 characters: letters, numbers, underscore") };
    }

    // Uniqueness check (case-insensitive). RLS allows public select on user_profiles.
    const { data: existing } = await supabase
      .from("user_profiles")
      .select("id")
      .ilike("username", trimmed)
      .maybeSingle();
    if (existing) {
      return { error: new Error("Username already taken") };
    }

    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { username: trimmed },
      },
    });
    return { error };
  };

  const signInWithGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    return { error: result.error ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (user) await loadProfile(user.id);
  };

  return (
    <AuthContext.Provider
      value={{ session, user, profile, loading, signIn, signUp, signInWithGoogle, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
