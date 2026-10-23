"use client";

import { Label, Select } from "@app/ui";
import { usePathname, useRouter } from "next/navigation";
import { CARD_COOKIE } from "./constants";

/**
 * Choix de l'idée qui remplit tous les designs. Mémorisé sur l'appareil (cookie) : le nom de la
 * carte ne peut pas être écrit dans le code, le dépôt étant public.
 */
export function CardPicker({
  ideas,
  current,
}: {
  ideas: { id: string; title: string }[];
  current: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <Label className="max-w-sm">
      Carte d&apos;exemple
      <Select
        value={current}
        onChange={(e) => {
          const id = e.target.value;
          document.cookie = `${CARD_COOKIE}=${encodeURIComponent(id)}; path=${pathname}; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
          router.replace(`${pathname}?carte=${encodeURIComponent(id)}`, { scroll: false });
        }}
      >
        {ideas.map((idea) => (
          <option key={idea.id} value={idea.id}>
            {idea.title}
          </option>
        ))}
      </Select>
    </Label>
  );
}
