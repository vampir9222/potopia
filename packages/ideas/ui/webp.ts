/** Plus grand côté de l'image envoyée, en pixels. */
const MAX_SIDE = 2048;
const QUALITY = 0.85;

/**
 * Réencode l'image en WebP dans le navigateur, réduite à MAX_SIDE px de côté. Le réencodage retire
 * aussi les métadonnées (EXIF, position GPS). Renvoie le fichier d'origine si le navigateur ne sait
 * pas encoder en WebP ou si l'image ne se décode pas.
 */
export async function toWebp(file: File): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", QUALITY),
  );
  // Sans encodeur WebP, toBlob renvoie du PNG : on garde alors l'original.
  if (!blob || blob.type !== "image/webp") return file;
  const name = file.name.replace(/\.[^.]*$/, "") + ".webp";
  return new File([blob], name, { type: "image/webp" });
}
