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
let mediaFocus = 0;
const focusPaused = new Set<HTMLMediaElement>();

/** Suit les sons qui jouent (pour pouvoir les mettre en pause). Appelé une fois, au montage. */
export function trackMedia(): void {
  if (patched || typeof HTMLMediaElement === "undefined") return;
  patched = true;
  const play = HTMLMediaElement.prototype.play;
  const pause = HTMLMediaElement.prototype.pause;
  HTMLMediaElement.prototype.pause = function (this: HTMLMediaElement) {
    focusPaused.delete(this);
    return pause.call(this);
  };
  HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
    if (mediaFocus > 0 && !this.dataset.mediaFocusProof) {
      if (this.loop) focusPaused.add(this);
      return Promise.resolve();
    }
    playing.add(this);
    this.addEventListener("pause", () => playing.delete(this), { once: true });
    this.addEventListener("ended", () => playing.delete(this), { once: true });
    return play.call(this);
  };
}

/** Réserve le son à un lecteur externe (GOTY/YouTube), sans arrêter les animations du portail. */
export function claimMediaFocus(): () => void {
  trackMedia();
  if (mediaFocus++ === 0) {
    for (const media of [...playing])
      if (!media.dataset.mediaFocusProof) {
        media.pause();
        if (media.loop) focusPaused.add(media);
      }
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--mediaFocus !== 0) return;
    const resume = [...focusPaused];
    focusPaused.clear();
    if (isTimeStopped()) suspended.push(...resume.filter((media) => !suspended.includes(media)));
    else resume.forEach((media) => media.play().catch(() => {}));
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
