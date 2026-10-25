/** Côté serveur uniquement : lecture des PNG sur le disque et encodage de la planche (sharp). */
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import sharp from "sharp";
import type { RgbaImage, SpriteLoader } from "./compose";

/**
 * Budget par défaut du cache des sprites décodés (octets RGBA, `width × height × 4`). Le catalogue
 * entier décodé pèse bien plus (plusieurs centaines de Mo) : on ne garde que les sprites récemment
 * utilisés.
 */
export const DEFAULT_SPRITE_CACHE_BYTES = 64 * 1024 * 1024;

export type FsSpriteLoader = SpriteLoader & {
  /** État du cache : nombre d'images décodées en mémoire et leur poids en octets. */
  stats: () => { entries: number; bytes: number };
};

function bytesOf(image: RgbaImage): number {
  return image.width * image.height * 4;
}

/**
 * Chargeur de sprites depuis un dossier (`public/avatar-assets` de l'app, `sprites/` en test).
 * Les images décodées sont gardées en mémoire dans la limite de `maxBytes` (LRU : au-delà, les
 * moins récemment utilisées sont évincées) ; une image plus grande que le budget est servie sans
 * être conservée.
 */
export function fsSpriteLoader(
  dir: string,
  { maxBytes = DEFAULT_SPRITE_CACHE_BYTES }: { maxBytes?: number } = {},
): FsSpriteLoader {
  const root = resolve(dir);
  // Ordre d'insertion = ordre d'utilisation : une entrée relue est replacée en fin de Map.
  const cache = new Map<string, RgbaImage>();
  const pending = new Map<string, Promise<RgbaImage>>();
  let bytes = 0;

  const remember = (path: string, image: RgbaImage) => {
    const size = bytesOf(image);
    if (size > maxBytes) return;
    cache.set(path, image);
    bytes += size;
    for (const [oldest, old] of cache) {
      if (bytes <= maxBytes) break;
      cache.delete(oldest);
      bytes -= bytesOf(old);
    }
  };

  const load: SpriteLoader = (file) => {
    const path = resolve(root, file);
    const inside = relative(root, path);
    // `relative` renvoie `..`-quelque chose (ou un chemin absolu, autre disque) hors du dossier ;
    // un simple `startsWith(dir)` laisserait passer un dossier voisin au même préfixe.
    if (inside.startsWith("..") || isAbsolute(inside) || !file.endsWith(".png")) {
      return Promise.reject(new Error(`Sprite invalide : ${file}`));
    }
    const cached = cache.get(path);
    if (cached) {
      cache.delete(path);
      cache.set(path, cached);
      return Promise.resolve(cached);
    }
    let image = pending.get(path);
    if (!image) {
      image = readFile(path)
        .then(decodePng)
        .then((decoded) => {
          remember(path, decoded);
          return decoded;
        })
        .finally(() => pending.delete(path));
      pending.set(path, image);
    }
    return image;
  };

  return Object.assign(load, {
    stats: () => ({ entries: cache.size, bytes }),
  });
}

export async function decodePng(input: Uint8Array): Promise<RgbaImage> {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    width: info.width,
    height: info.height,
    data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
  };
}

/** PNG sans perte, compressé au mieux (planche servie souvent, composée rarement). */
export async function encodePng(image: RgbaImage): Promise<Buffer> {
  return sharp(Buffer.from(image.data.buffer, image.data.byteOffset, image.data.byteLength), {
    raw: { width: image.width, height: image.height, channels: 4 },
  })
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();
}
