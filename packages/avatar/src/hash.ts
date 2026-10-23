import type { Catalog } from "@app/avatar-assets";
import type { AvatarConfig } from "./config";

/** À incrémenter quand le rendu change (disposition, mélange…) : toutes les planches sont refaites. */
export const RENDER_VERSION = 1;

/** JSON aux clés triées : deux configs égales donnent la même chaîne, quel que soit l'ordre. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Empreinte d'une planche : config, version du rendu et commit LPC importé. Sert de nom de fichier
 * (`avatars/<userId>-<hash>.png`) et invalide le cache des navigateurs quand elle change.
 */
export async function configHash(
  config: AvatarConfig,
  catalog: Pick<Catalog, "source">,
): Promise<string> {
  const input = `${RENDER_VERSION}|${catalog.source.ref}|${canonicalJson(config)}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)]
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
