import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

type ModuleScaffoldProps = {
  title: string;
  eyebrow: string;
  description: string;
  errorMessage?: string;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  children: React.ReactNode;
};

export function ModuleScaffold({
  title,
  eyebrow,
  description,
  errorMessage,
  isLoading,
  isEmpty,
  emptyTitle,
  emptyDescription,
  children
}: ModuleScaffoldProps) {
  return (
    <section className="module-page">
      <div className="module-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="muted">{description}</p>
        </div>
      </div>
      {errorMessage ? <div className="form-error">{errorMessage}</div> : null}
      {isLoading ? (
        <Card>
          <div className="loading-state">Loading {title.toLowerCase()}...</div>
        </Card>
      ) : isEmpty ? (
        <Card>
          <EmptyState
            title={emptyTitle ?? `No ${title.toLowerCase()} yet`}
            description={emptyDescription ?? "Create the first record to get started."}
          />
        </Card>
      ) : (
        children
      )}
    </section>
  );
}
