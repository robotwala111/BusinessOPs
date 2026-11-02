"use client";

import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { authService } from "@/services/authService";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import type { Profile } from "@/types/auth";

const DEMO_AUTH_STORAGE_KEY = "business-ops-demo-auth";
const DEMO_EMAIL = "demo-admin@example.local";
const DEMO_PASSWORD = "Admin@123";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isConfigured: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const demoUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: DEMO_EMAIL
} as User;

const demoProfile: Profile = {
  id: demoUser.id,
  full_name: "Demo Admin",
  email: DEMO_EMAIL,
  role: "admin",
  company_name: "Business Operations",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

type AuthProviderProps = {
  children: React.ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await authService.getProfile(userId);

    if (error) {
      setProfile(null);
      return;
    }

    setProfile(data);
  }, []);

  useEffect(() => {
    if (!supabase) {
      const hasDemoSession = window.localStorage.getItem(DEMO_AUTH_STORAGE_KEY) === "true";

      if (hasDemoSession) {
        setSession({ user: demoUser } as Session);
        setProfile(demoProfile);
      }

      setIsLoading(false);
      return;
    }

    let isMounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!isMounted) {
        return;
      }

      setSession(data.session);

      if (data.session?.user) {
        await loadProfile(data.session.user.id);
      }

      setIsLoading(false);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);

      if (nextSession?.user) {
        void loadProfile(nextSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      profile,
      isLoading,
      isConfigured: isSupabaseConfigured,
      async login(email, password) {
        if (!supabase) {
          if (email !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
            throw new Error("Use demo-admin@example.local with password Admin@123.");
          }

          window.localStorage.setItem(DEMO_AUTH_STORAGE_KEY, "true");
          setSession({ user: demoUser } as Session);
          setProfile(demoProfile);
          return;
        }

        const { error } = await authService.login(email, password);

        if (error) {
          throw error;
        }
      },
      async register(email, password, fullName) {
        if (!supabase) {
          window.localStorage.setItem(DEMO_AUTH_STORAGE_KEY, "true");
          setSession({
            user: {
              ...demoUser,
              email
            }
          } as Session);
          setProfile({
            ...demoProfile,
            full_name: fullName,
            email
          });
          return;
        }

        const { error } = await authService.register({ email, password, fullName });

        if (error) {
          throw error;
        }
      },
      async logout() {
        if (!supabase) {
          window.localStorage.removeItem(DEMO_AUTH_STORAGE_KEY);
          setSession(null);
          setProfile(null);
          return;
        }

        const { error } = await authService.logout();

        if (error) {
          throw error;
        }
      },
      async sendPasswordReset(email) {
        if (!supabase) {
          return;
        }

        const { error } = await authService.sendPasswordReset(email);

        if (error) {
          throw error;
        }
      }
    }),
    [isLoading, profile, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}
