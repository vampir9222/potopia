// Images des animations (planches de sprites, décors) téléchargées et décodées à l'avance : sans
// ça, la première fois qu'une planche s'affiche (Sonic qui passe de l'attente à la course, le fruit
// qui devient Luffy…), le navigateur la télécharge à ce moment-là et le personnage disparaît le
// temps du chargement. Les images restent référencées ici, pour que le navigateur les garde
// décodées en mémoire.

const images = new Map<string, { img: HTMLImageElement; ready: Promise<void> }>();

function load(src: string) {
  let entry = images.get(src);
  if (!entry) {
    const img = new Image();
    img.decoding = "async";
    img.src = src;
    // une image introuvable ne doit pas bloquer l'animation : elle sera juste absente
    const ready = img.decode().catch(() => {});
    entry = { img, ready };
    images.set(src, entry);
  }
  return entry;
}

/** Lance le téléchargement et le décodage ; la promesse se résout quand tout est prêt. */
export function preloadImages(srcs: readonly string[]): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  return Promise.all(srcs.map((src) => load(src).ready)).then(() => {});
}

/** Toutes ces images sont déjà téléchargées et décodées. */
export function imagesReady(srcs: readonly string[]): boolean {
  return srcs.every((src) => {
    const img = images.get(src)?.img;
    return img !== undefined && img.complete && img.naturalWidth > 0;
  });
}
