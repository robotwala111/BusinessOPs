import type { HTMLAttributes } from "react";

type ModalProps = HTMLAttributes<HTMLDivElement>;

export function Modal({ children, className = "", ...props }: ModalProps) {
  return (
    <div className="modal-backdrop">
      <div
        role="dialog"
        aria-modal="true"
        className={`modal ${className}`.trim()}
        {...props}
      >
        {children}
      </div>
    </div>
  );
}
