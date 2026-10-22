import type { Role } from "../users";

/**
 * Vrai si l'ID Discord figure dans ADMIN_DISCORD_IDS. L'env est relu à chaque appel :
 * retirer un ID révoque les droits immédiatement, sans attendre une reconnexion.
 */
export function isAdmin(discordId: string | null | undefined): boolean {
  if (!discordId) return false;
  const ids = (process.env.ADMIN_DISCORD_IDS ?? "").split(",").map((id) => id.trim());
  return ids.includes(discordId);
}

export function roleOf(discordId: string | null | undefined): Role {
  return isAdmin(discordId) ? "admin" : "member";
}
