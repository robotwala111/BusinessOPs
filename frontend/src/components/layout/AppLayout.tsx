import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

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
    </div>
  );
}
