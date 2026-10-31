/**
 * Horloge commune des animations du site, que « ZA WARUDO » (thème JoJo) peut arrêter. Les
 * animations en JavaScript lisent `timeNow()` au lieu de `performance.now()` : pendant l'arrêt
 * elle ne bouge plus (tout se fige), puis elle repart d'où elle s'était arrêtée. Les sons en cours
 * sont mis en pause et reprennent ensuite, sauf ceux marqués `data-time-stop-proof` (la voix de
 * DIO elle-même).
 */

let stoppedAt: number | null = null;
let pausedTotal = 0;
const listeners = new Set<(stopped: boolean) => void>();

const playing = new Set<HTMLMediaElement>();
let suspended: HTMLMediaElement[] = [];
let patched = false;

/** Suit les sons qui jouent (pour pouvoir les mettre en pause). Appelé une fois, au montage. */
export function trackMedia(): void {
  if (patched || typeof HTMLMediaElement === "undefined") return;
  patched = true;
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
    playing.add(this);
    this.addEventListener("pause", () => playing.delete(this), { once: true });
    this.addEventListener("ended", () => playing.delete(this), { once: true });
    return play.call(this);
  };
}

/** Temps des animations, en ms : figé pendant un arrêt du temps. */
export function timeNow(): number {
  return (stoppedAt ?? performance.now()) - pausedTotal;
}

export const isTimeStopped = (): boolean => stoppedAt !== null;

export function stopTime(): void {
  if (stoppedAt !== null) return;
  stoppedAt = performance.now();
  suspended = [...playing].filter((m) => !m.paused && !m.dataset.timeStopProof);
  suspended.forEach((m) => m.pause());
  listeners.forEach((fn) => fn(true));
}

export function resumeTime(): void {
  if (stoppedAt === null) return;
  pausedTotal += performance.now() - stoppedAt;
  stoppedAt = null;
  suspended.forEach((m) => m.play().catch(() => {}));
  suspended = [];
  listeners.forEach((fn) => fn(false));
}

/** Prévenu quand le temps s'arrête ou reprend (pour une musique en Web Audio, par exemple). */
export function onTimeStop(fn: (stopped: boolean) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
