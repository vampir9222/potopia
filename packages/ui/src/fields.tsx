import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cx } from "./cx";

const field =
  "w-full rounded-md border border-border bg-bg px-3 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none disabled:opacity-50 aria-invalid:border-danger";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(field, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(field, "min-h-24 py-2", className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(field, "h-10", className)} {...props} />;
}

type LabelProps = LabelHTMLAttributes<HTMLLabelElement> & {
  /** Texte d'aide ou compteur affiché sous le champ. */
  hint?: string;
};

/** Libellé qui englobe son champ : `<Label>Titre<Input /></Label>`. */
export function Label({ className, hint, children, ...props }: LabelProps) {
  return (
    <label className={cx("text-muted flex flex-col gap-1 text-sm", className)} {...props}>
      {children}
      {hint && <span className="text-muted text-xs">{hint}</span>}
    </label>
  );
}
