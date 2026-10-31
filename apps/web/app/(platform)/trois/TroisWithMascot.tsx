"use client";

import { type Me, TroisApp, type TroisReaction } from "@app/trois/ui";
import { Mascot, type MascotMood } from "@/components/Mascot";

const MOODS: Record<NonNullable<TroisReaction>, MascotMood> = { won: "victoire", lost: "erreur" };

/** TROIS avec la mascotte sous le podium : elle saute sur un mot trouvé, s'affaisse sur un perdu. */
export function TroisWithMascot({ me }: { me: Me }) {
  return (
    <TroisApp
      me={me}
      belowPodium={(reaction) => (
        <Mascot height={180} mood={reaction ? MOODS[reaction] : "repos"} />
      )}
    />
  );
}
