export function TemplateSelector({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: Array<{ id: string; name: string }> }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)}><option value="">Select template</option>{options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select>;
}
