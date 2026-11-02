import { Card } from "@/components/ui/Card";

export function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card><h2>{title}</h2>{children}</Card>;
}
