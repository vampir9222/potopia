import type { ReactNode } from "react";
import { cx } from "./cx";

type Props = {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, description, icon, action, className }: Props) {
  return (
    <div className={cx("flex flex-col items-center gap-2 py-8 text-center", className)}>
      {icon && <div className="text-muted">{icon}</div>}
      <p className="text-text text-sm font-medium">{title}</p>
      {description && <p className="text-muted max-w-sm text-sm">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
