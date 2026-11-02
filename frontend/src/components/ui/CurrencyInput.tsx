import { Input } from "@/components/ui/Input";

export function CurrencyInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <Input type="number" step="0.01" value={value} onChange={(event) => onChange(Number(event.target.value))} />;
}
