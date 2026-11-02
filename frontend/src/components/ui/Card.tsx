import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ children, className = "", ...props }: CardProps) {
  return (
    <div className={`card ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
