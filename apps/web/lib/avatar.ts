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

/**
 * Champs du payload d'un événement dont la place a besoin (voir `reactions.ts`), par `app/type`.
 * Le reste n'est pas relayé au navigateur : les payloads ne portent que des compteurs, mais la
 * liste blanche évite qu'un nouveau champ parte sur `/api/place` sans qu'on l'ait décidé.
 */
const PLACE_PAYLOAD_FIELDS: Record<string, readonly string[]> = {
  "trois/day_completed": ["found"],
};

function placePayload(app: string, type: string, payload: unknown): Record<string, unknown> {
  const fields = PLACE_PAYLOAD_FIELDS[`${app}/${type}`];
  if (!fields || !payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  const source = payload as Record<string, unknown>;
  return Object.fromEntries(fields.filter((key) => key in source).map((key) => [key, source[key]]));
}

/**
 * Membres de la place et événements publiés depuis `since` (aucun au premier affichage).
 * `now`, que le client renverra comme prochain `since`, est la date du dernier événement livré
 * (sinon l'heure du serveur) : si la liste est tronquée, le prochain appel reprend là où celle-ci
 * s'arrête au lieu de sauter les événements les plus récents.
 */
export async function getPlaceSnapshot(since?: Date): Promise<PlaceSnapshot> {
  const now = new Date();
  const [members, events] = await Promise.all([
    listPlaceMembers(),
    since ? listEventsSince(since) : Promise.resolve([]),
  ]);
  const last = events.at(-1)?.createdAt ?? now;
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
      payload: placePayload(e.app, e.type, e.payload),
    })),
    now: last.toISOString(),
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
