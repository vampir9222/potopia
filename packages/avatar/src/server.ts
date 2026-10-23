/** Côté serveur uniquement : lecture des PNG sur le disque et encodage de la planche (sharp). */
import { readFile } from "node:fs/promises";
import { join, normalize } from "node:path";
import sharp from "sharp";
import type { RgbaImage, SpriteLoader } from "./compose";

/**
 * Chargeur de sprites depuis un dossier (`public/avatar-assets` de l'app, `sprites/` en test).
 * Les images décodées restent en mémoire : ce sont des fichiers statiques.
 */
export function fsSpriteLoader(dir: string): SpriteLoader {
  const cache = new Map<string, Promise<RgbaImage>>();
  return (file) => {
    const path = normalize(join(dir, file));
    if (!path.startsWith(normalize(dir)) || !file.endsWith(".png")) {
      return Promise.reject(new Error(`Sprite invalide : ${file}`));
    }
    let image = cache.get(path);
    if (!image) {
      image = readFile(path).then(decodePng);
      image.catch(() => cache.delete(path));
      cache.set(path, image);
    }
    return image;
  };
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
