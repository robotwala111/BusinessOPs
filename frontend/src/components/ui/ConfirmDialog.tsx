import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export function ConfirmDialog({ title, description, onCancel, onConfirm }: { title: string; description?: string; onCancel: () => void; onConfirm: () => void }) {
  return <Modal><h2>{title}</h2>{description ? <p className="muted">{description}</p> : null}<div className="modal-actions"><Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button><Button type="button" variant="danger" onClick={onConfirm}>Confirm</Button></div></Modal>;
}
