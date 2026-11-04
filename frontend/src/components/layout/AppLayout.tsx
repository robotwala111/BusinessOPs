import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { CommandPalette } from "./CommandPalette";
import { FloatingAIChatWidget } from "@/components/ai-widget/FloatingAIChatWidget";

type AppLayoutProps = {
  children: React.ReactNode;
};

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-main">
        <Topbar />
        <main>{children}</main>
      </div>
      <CommandPalette />
      <FloatingAIChatWidget />
    </div>
  );
}
