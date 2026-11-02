import { Input } from "@/components/ui/Input";

export function DateInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <Input type="date" value={value} onChange={(event) => onChange(event.target.value)} />;
}
