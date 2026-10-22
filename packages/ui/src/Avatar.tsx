import { cx } from "./cx";

type Props = {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
};

/** Image ronde, ou initiale du nom si pas d'image. */
export function Avatar({ name, src, size = 32, className }: Props) {
  // Liseré doré, comme un médaillon.
  const base = cx(
    "bg-surface-hover shrink-0 rounded-full ring-1 ring-accent/50 ring-offset-1 ring-offset-bg",
    className,
  );
  if (src) {
    return <img src={src} alt="" width={size} height={size} className={base} />;
  }
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      className={cx(base, "text-muted flex items-center justify-center font-medium")}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
