import { AvatarSprite } from "@app/avatar/ui";
import { buttonClasses } from "@app/ui";
import { Shirt } from "lucide-react";
import Link from "next/link";
import { avatarLayout, avatarSheetUrl } from "@/lib/avatar";

/** Colonne de gauche : le personnage du membre, au repos et de face, avec l'accès à l'éditeur. */
export function AvatarFigure({
  userId,
  name,
  hash,
}: {
  userId: string;
  name: string;
  hash: string | null;
}) {
  return (
    <div className="relative flex h-32 items-end justify-center">
      {hash && (
        <AvatarSprite
          sheet={avatarSheetUrl(userId, hash)}
          layout={avatarLayout}
          scale={2}
          label={`Avatar de ${name}`}
        />
      )}
      <Link
        href="/avatar"
        className={buttonClasses({
          variant: "secondary",
          size: "sm",
          className: "absolute right-0 bottom-1",
        })}
      >
        <Shirt size={14} aria-hidden /> Avatar
      </Link>
    </div>
  );
}
