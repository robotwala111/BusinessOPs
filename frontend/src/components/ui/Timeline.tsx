export function Timeline({ items }: { items: Array<{ label: string; date?: string | null }> }) {
  return <ol className="timeline">{items.map((item) => <li key={`${item.label}-${item.date ?? ""}`}><strong>{item.label}</strong>{item.date ? <span>{item.date}</span> : null}</li>)}</ol>;
}
