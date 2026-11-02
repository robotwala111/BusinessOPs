import type { TableHTMLAttributes } from "react";

type TableProps = TableHTMLAttributes<HTMLTableElement>;

export function Table({ children, className = "", ...props }: TableProps) {
  return (
    <div className="table-wrap">
      <table className={`table ${className}`.trim()} {...props}>
        {children}
      </table>
    </div>
  );
}
