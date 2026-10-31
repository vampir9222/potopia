import { getUser, isAdmin } from "@app/core";
import type { DbTx } from "@app/db";
import { GotyError } from "./errors";

/** L'appelant vérifie la session ; l'acteur provient de celle-ci, jamais du navigateur. */
export async function resolveActor(userId: string) {
  const user = await getUser(userId);
  if (!user) throw new GotyError("FORBIDDEN", "Membre introuvable.", 403);
  return { userId: user.id, admin: isAdmin(user.discordId) };
}

export type Actor = Awaited<ReturnType<typeof resolveActor>>;

/** Interne : ne jamais exposer la ligne édition (écran et tirages) comme réponse publique. */
export async function editionAccess(tx: DbTx, editionId: string, actor: Actor) {
  // Stabilise phase, version et inscriptions pendant la lecture. Les mutations prennent
  // FOR UPDATE sur cette même ligne avant de modifier les données de l'édition.
  await tx.$queryRaw`SELECT id FROM "goty"."editions" WHERE id = ${editionId} FOR SHARE`;
  const edition = await tx.gotyEdition.findUnique({ where: { id: editionId } });
  if (!edition) throw new GotyError("NOT_FOUND", "Édition introuvable.", 404);
  const membership = await tx.gotyMember.findUnique({
    where: { editionId_userId: { editionId, userId: actor.userId } },
  });
  if (!actor.admin && !membership && edition.phase !== "closed") {
    throw new GotyError("FORBIDDEN", "Tu ne participes pas à cette édition.", 403);
  }
  return {
    edition,
    membership,
    permissions: {
      organize: actor.admin || Boolean(membership?.organizer),
      present: actor.admin || Boolean(membership?.presenter),
      participate: Boolean(membership),
    },
  };
}
