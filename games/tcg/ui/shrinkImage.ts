/** Côté le plus long d'une illustration envoyée : assez pour une carte agrandie, écran haute densité. */
const MAX_SIDE = 1200;
/** En dessous de ce poids, une image déjà à la bonne taille part telle quelle. */
const SMALL_ENOUGH = 400 * 1024;

/**
 * Réduit une illustration dans le navigateur avant son envoi (WebP, 1 200 px au plus de côté) : les
 * planches chargent des dizaines d'images, une photo de 4 000 px y est inutilement lourde. Renvoie
 * le fichier d'origine si le navigateur ne sait pas le décoder ou si la réduction n'y gagne rien.
 */
export async function shrinkImage(file: File): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= SMALL_ENOUGH) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/webp", 0.85));
  if (!blob || blob.type !== "image/webp" || blob.size >= file.size) return file;
  return new File([blob], file.name.replace(/\.[^.]*$/, "") + ".webp", { type: "image/webp" });
}
