import { supabase } from "@/lib/supabase/client";

type RegisterInput = {
  email: string;
  password: string;
  fullName: string;
};

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase environment variables are not configured.");
  }

  return supabase;
}

export const authService = {
  async login(email: string, password: string) {
    return requireSupabase().auth.signInWithPassword({ email, password });
  },

  async register({ email, password, fullName }: RegisterInput) {
    return requireSupabase().auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    });
  },

  async logout() {
    return requireSupabase().auth.signOut();
  },

  async sendPasswordReset(email: string) {
    return requireSupabase().auth.resetPasswordForEmail(email);
  },

  async getProfile(userId: string) {
    return requireSupabase()
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
  }
};
