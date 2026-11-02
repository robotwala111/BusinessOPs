import { Card } from "@/components/ui/Card";

export function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card><h2>{title}</h2>{children}</Card>;
}
