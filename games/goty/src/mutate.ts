import { withTx, type DbTx } from "@app/db";
import { editionAccess, resolveActor } from "./access";
import { GotyError } from "./errors";

export type EditionInput = { actorId: string; editionId: string };
export type Options = { tx?: DbTx };

/** Toutes les écritures métier d'une édition partagent le même verrou. */
export async function mutateEdition<T extends object>(
  input: EditionInput & { expectedVersion?: number },
  fn: (tx: DbTx, access: Awaited<ReturnType<typeof editionAccess>>) => Promise<T>,
  opts?: Options,
) {
  const actor = await resolveActor(input.actorId);
  return withTx(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "goty"."editions" WHERE id = ${input.editionId} FOR UPDATE`;
    const access = await editionAccess(tx, input.editionId, actor);
    if (access.edition.phase === "closed")
      throw new GotyError("CONFLICT", "Cette édition est archivée.", 409);
    if (input.expectedVersion !== undefined && input.expectedVersion !== access.edition.version) {
      throw new GotyError("CONFLICT", "L’édition a changé. Actualise la page.", 409);
    }
    const result = await fn(tx, access);
    const { version } = await tx.gotyEdition.update({
      where: { id: input.editionId },
      data: { version: { increment: 1 } },
      select: { version: true },
    });
    return { ...result, version };
  }, opts);
}

export function requireParticipant(membership: unknown): asserts membership {
  if (!membership) throw new GotyError("FORBIDDEN", "Réservé aux participants.", 403);
}
