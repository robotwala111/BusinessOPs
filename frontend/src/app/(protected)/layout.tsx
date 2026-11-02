import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";

type ProtectedLayoutProps = {
  children: React.ReactNode;
};

export default function ProtectedLayout({ children }: ProtectedLayoutProps) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  );
}
