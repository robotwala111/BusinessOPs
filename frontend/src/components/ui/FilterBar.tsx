import { Card } from "@/components/ui/Card";

export function FilterBar({ children }: { children: React.ReactNode }) {
  return <Card className="toolbar-card"><div className="clients-toolbar">{children}</div></Card>;
}
