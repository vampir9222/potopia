import type { RgbaImage, SpriteLoader } from "../src/compose";

/** Dossier public des sprites dans l'app web (copie de @app/avatar-assets/sprites). */
export const SPRITES_URL = "/avatar-assets/";

function canvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  const el = document.createElement("canvas");
  el.width = width;
  el.height = height;
  return el;
}

function context2d(c: OffscreenCanvas | HTMLCanvasElement) {
  const ctx = c.getContext("2d", { willReadFrequently: true }) as
    OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
  if (!ctx) throw new Error("Canvas 2D indisponible.");
  return ctx;
}

async function decode(url: string): Promise<RgbaImage> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sprite introuvable : ${url}`);
  const bitmap = await createImageBitmap(await res.blob());
  const ctx = context2d(canvas(bitmap.width, bitmap.height));
  ctx.drawImage(bitmap, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  bitmap.close();
  return { width, height, data };
}

const cache = new Map<string, Promise<RgbaImage>>();

/** Chargeur de sprites du navigateur (aperçu de l'éditeur), avec cache pour toute la page. */
export const browserSpriteLoader: SpriteLoader = (file) => {
  const url = `${SPRITES_URL}${file}`;
  let image = cache.get(url);
  if (!image) {
    image = decode(url);
    image.catch(() => cache.delete(url));
    cache.set(url, image);
  }
  return image;
};

/** Image RGBA → bitmap dessinable sur un canvas. */
export async function toBitmap(image: RgbaImage): Promise<ImageBitmap> {
  return createImageBitmap(
    new ImageData(new Uint8ClampedArray(image.data), image.width, image.height),
  );
}

/** Charge une planche composée (URL de l'app) en bitmap. */
export async function loadSheet(url: string): Promise<ImageBitmap> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Planche introuvable : ${url}`);
  return createImageBitmap(await res.blob());
}
