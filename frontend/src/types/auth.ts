export type AuthUser = {
  id: string;
  email: string;
};

export type UserRole = "admin" | "staff";

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: UserRole;
  company_name: string;
  created_at: string;
  updated_at: string;
};
