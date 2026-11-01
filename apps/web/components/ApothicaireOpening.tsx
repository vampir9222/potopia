"use client";

/* eslint-disable @next/next/no-img-element -- image détourée déjà optimisée (WebP), pas de next/image */
import { APOTHICAIRE_EVENT, cx, effectiveVolume, preloadImages } from "@app/ui";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const OPENING_MS = 6800;
const FADE_MS = 700;
const TITLE = "薬屋のひとりごと";
const PORTRAIT = "/apothicaire/opening-maomao.webp";
// les premières mesures de l'opening (« Hana ni Natte », Ryokuoushoku Shakai)
const MUSIC = "/audio/apothicaire-opening.mp3";
const VOLUME = 0.7;

/** Baisse le son en `ms` puis l'arrête. */
function fadeOut(a: HTMLAudioElement | null, ms: number) {
  if (!a) return;
  const start = a.volume;
  const step = window.setInterval(() => {
    a.volume = Math.max(0, a.volume - start / 10);
    if (a.volume <= 0) {
      window.clearInterval(step);
      a.pause();
    }
  }, ms / 10);
}

/**
 * Ouverture du thème Apothicaire : la page s'assombrit sous une pluie de pétales de prunier, un
 * rouleau horizontal (makimono) se déroule depuis le centre, le titre 「薬屋のひとりごと」 s'écrit
 * caractère après caractère, Mao Mao apparaît à côté et le sceau 「猫猫」 s'imprime, sur les
 * premières mesures de l'opening. Un clic ferme ; la musique s'éteint en fondu. Déclenché par
 * `apothicaire()` de `@app/ui` (choix du thème). Monté une fois, layout racine.
 */
export function ApothicaireOpening() {
  const [key, setKey] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const clear = () => {
      for (const t of timers.current) window.clearTimeout(t);
      timers.current = [];
    };
    const onOpen = () => {
      clear();
      void preloadImages([PORTRAIT]);
      setLeaving(false);
      setKey(Date.now());
      const volume = effectiveVolume() * VOLUME;
      if (volume > 0) {
        audio.current?.pause();
        const a = new Audio(MUSIC);
        a.volume = volume;
        void a.play().catch(() => {});
        audio.current = a;
      }
      timers.current.push(
        window.setTimeout(() => {
          setLeaving(true);
          fadeOut(audio.current, FADE_MS);
        }, OPENING_MS - FADE_MS),
        window.setTimeout(() => setKey(0), OPENING_MS),
      );
    };
    window.addEventListener(APOTHICAIRE_EVENT, onOpen);
    // on quitte l'onglet : la musique ne continue pas en fond
    const onHide = () => {
      if (document.hidden) {
        audio.current?.pause();
        setKey(0);
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener(APOTHICAIRE_EVENT, onOpen);
      document.removeEventListener("visibilitychange", onHide);
      clear();
      audio.current?.pause();
    };
  }, []);

  if (!key) return null;

  const close = () => {
    for (const t of timers.current) window.clearTimeout(t);
    setLeaving(true);
    fadeOut(audio.current, FADE_MS);
    timers.current = [window.setTimeout(() => setKey(0), FADE_MS)];
  };

  return createPortal(
    <div
      key={key}
      className={cx("apo-open", leaving && "apo-open-leave")}
      role="dialog"
      aria-label="Les Carnets de l'apothicaire"
      onClick={close}
    >
      <div className="apo-open-petals" aria-hidden>
        {Array.from({ length: 22 }, (_, i) => (
          <span key={i} style={{ "--i": i } as CSSProperties} />
        ))}
      </div>
      <div className="apo-makimono">
        <span className="apo-makimono-rod apo-makimono-rod-left" aria-hidden />
        <div className="apo-makimono-unroll">
          <div className="apo-makimono-paper">
            <img src={PORTRAIT} alt="" className="apo-open-portrait" />
            <h2 className="apo-open-title" lang="ja">
              {[...TITLE].map((c, i) => (
                <span key={i} style={{ "--i": i } as CSSProperties}>
                  {c}
                </span>
              ))}
            </h2>
            <p className="apo-open-sub">Les Carnets de l&apos;apothicaire</p>
            <span className="apo-open-seal" lang="zh" aria-hidden>
              猫猫
            </span>
          </div>
        </div>
        <span className="apo-makimono-rod apo-makimono-rod-right" aria-hidden />
      </div>
    </div>,
    document.body,
  );
}
