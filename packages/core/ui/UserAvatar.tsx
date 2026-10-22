type Props = {
  user: { name: string; image: string | null };
  size?: number;
};

/** Avatar Discord, ou initiale si l'utilisateur n'en a pas. */
export function UserAvatar({ user, size = 32 }: Props) {
  if (user.image) {
    return (
      <img
        src={user.image}
        alt=""
        width={size}
        height={size}
        className="bg-surface shrink-0 rounded-full"
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className="bg-surface text-muted flex shrink-0 items-center justify-center rounded-full text-sm"
    >
      {user.name.charAt(0).toUpperCase()}
    </span>
  );
}
