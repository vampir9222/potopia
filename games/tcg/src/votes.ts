import { ForbiddenError, isAdmin } from "@app/core";
import { db, type DbTx } from "@app/db";
import { z } from "zod";
import { DESIGN_IDS, type DesignId } from "./designs";

export type DesignVote = {
  designId: DesignId;
  userId: string;
  stars: number;
  comment: string | null;
  updatedAt: Date;
};

/** Utilisateur qui note ou lit : seuls les admins (ADMIN_DISCORD_IDS) y ont droit. */
type Admin = { id: string; discordId: string | null };

function assertAdmin(reader: Admin): void {
  if (!isAdmin(reader.discordId)) throw new ForbiddenError("Réservé aux admins.");
}

const rateInput = z.object({
  designId: z.enum(DESIGN_IDS, "Design inconnu."),
  // 0 = pas de note (commentaire seul, ou note retirée).
  stars: z.coerce
    .number()
    .int("Note entière attendue.")
    .min(0, "Note de 0 à 5 étoiles.")
    .max(5, "Note de 0 à 5 étoiles."),
  comment: z
    .string()
    .trim()
    .max(1000, "Commentaire trop long (1000 caractères maximum).")
    .nullish()
    .transform((c) => c || null),
});

function toVote(row: {
  designId: string;
  userId: string;
  stars: number;
  comment: string | null;
  updatedAt: Date;
}): DesignVote {
  return { ...row, designId: row.designId as DesignId };
}

/** Note telle qu'envoyée (formulaire) : validée par rateInput. */
export type RateInput = { designId: string; stars: number | string; comment?: string | null };

/** Enregistre (ou remplace) la note de l'admin sur un design. Lève ForbiddenError pour un non-admin. */
export async function rateDesign(
  admin: Admin,
  input: RateInput,
  opts?: { tx?: DbTx },
): Promise<DesignVote> {
  assertAdmin(admin);
  const { designId, stars, comment } = rateInput.parse(input);
  const row = await (opts?.tx ?? db).tcgDesignVote.upsert({
    where: { designId_userId: { designId, userId: admin.id } },
    create: { designId, userId: admin.id, stars, comment },
    update: { stars, comment },
  });
  return toVote(row);
}

/** Toutes les notes de tous les admins, la plus récente d'abord. Lève ForbiddenError pour un non-admin. */
export async function listDesignVotes(reader: Admin): Promise<DesignVote[]> {
  assertAdmin(reader);
  const rows = await db.tcgDesignVote.findMany({ orderBy: { updatedAt: "desc" } });
  return rows.map(toVote);
}
