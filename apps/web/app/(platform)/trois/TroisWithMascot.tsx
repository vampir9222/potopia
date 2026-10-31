"use client";

import { type Me, TroisApp, type TroisReaction } from "@app/trois/ui";
import type { MascotMood } from "@/components/Mascot";
import { MascotAnchor } from "@/components/MascotAnchor";

const MOODS: Record<NonNullable<TroisReaction>, MascotMood> = { won: "victoire", lost: "erreur" };

/**
 * TROIS avec une place pour la mascotte flottante sous le podium : elle quitte son coin pour s'y
 * poser, saute sur un mot trouvé et s'affaisse sur un mot perdu.
 */
export function TroisWithMascot({ me }: { me: Me }) {
  return (
    <TroisApp
      me={me}
      belowPodium={(reaction) => (
        <MascotAnchor mood={reaction ? MOODS[reaction] : "repos"} chatty />
      )}
    />
  );
}
