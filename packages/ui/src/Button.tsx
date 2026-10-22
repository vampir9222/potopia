import type { ButtonHTMLAttributes } from "react";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const variants: Record<ButtonVariant, string> = {
  primary:
    "shine bg-(image:--accent-gradient) text-on-accent shadow-[0_0_0_1px_rgb(0_0_0/0.3),0_6px_20px_-8px_var(--accent)] hover:shadow-[0_0_0_1px_rgb(0_0_0/0.3),0_8px_28px_-6px_var(--accent)] hover:-translate-y-px",
  secondary:
    "border border-(--frame) bg-surface text-text hover:border-accent/60 hover:bg-surface-hover",
  ghost: "text-muted hover:bg-surface hover:text-text",
  danger: "bg-danger text-on-accent hover:opacity-90",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-xs",
  md: "h-10 gap-2 px-4 text-sm",
};

/** Classes d'un bouton, pour styler un lien (`<a className={buttonClasses()}>`). */
export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}): string {
  return cx(
    "inline-flex items-center justify-center rounded-md font-semibold transition-all duration-200 active:translate-y-0 disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({ variant, size, className, type = "button", ...props }: Props) {
  return <button type={type} className={buttonClasses({ variant, size, className })} {...props} />;
}
