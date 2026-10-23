import { join } from "node:path";
import { sheetLayout, type SheetLayout } from "@app/avatar";
import { fsSpriteLoader } from "@app/avatar/server";
import { catalog } from "@app/avatar-assets";
import { ensureAvatar, getAvatar, listEventsSince, listPlaceMembers, type Avatar } from "@app/core";
import type { PlaceSnapshot } from "@app/avatar/ui";
import { cache } from "react";

/** Sprites copiés dans public/ par `pnpm generate` (et embarqués dans les fonctions Vercel). */
export const sprites = fsSpriteLoader(join(process.cwd(), "public", "avatar-assets"));

/** Disposition des planches composées (identique pour tous les avatars). */
export const avatarLayout: SheetLayout = sheetLayout(catalog);

/** URL de la planche d'un membre : l'empreinte dans le chemin invalide le cache à chaque changement. */
export function avatarSheetUrl(userId: string, hash: string): string {
  return `/api/avatars/${encodeURIComponent(userId)}/${hash}`;
}

/** Membres de la place et événements publiés depuis `since` (aucun au premier affichage). */
export async function getPlaceSnapshot(since?: Date): Promise<PlaceSnapshot> {
  const now = new Date();
  const [members, events] = await Promise.all([
    listPlaceMembers(),
    since ? listEventsSince(since) : Promise.resolve([]),
  ]);
  return {
    members: members.map((m) => ({
      id: m.userId,
      name: m.name,
      sheetUrl: avatarSheetUrl(m.userId, m.configHash),
      lastSeenAt: m.lastSeenAt.toISOString(),
    })),
    // Ni contenu ni date : seulement qui a fait quoi, pour animer son avatar.
    events: events.map((e) => ({
      id: e.id,
      userId: e.userId,
      app: e.app,
      type: e.type,
      payload: e.payload,
    })),
    now: now.toISOString(),
  };
}

/**
 * Avatar du membre connecté, créé à sa première visite (ou recomposé après un import). Une panne
 * du stockage ne doit pas bloquer la plateforme : on retombe alors sur l'avatar existant.
 * Dédupliqué sur la requête.
 */
export const getOwnAvatar = cache(async (userId: string): Promise<Avatar | null> => {
  try {
    return await ensureAvatar({ userId, sprites });
  } catch (error) {
    console.error("Avatar indisponible :", error);
    return getAvatar(userId);
  }
});
