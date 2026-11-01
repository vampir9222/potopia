"use client";

import { cx, effectiveVolume, preloadImages } from "@app/ui";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/*
 * Les personnages du décor du thème Apothicaire (ApothicaireDecor de @app/ui) répondent au clic,
 * avec de vrais extraits de l'anime : une vignette (GIF de l'anime en MP4) s'ouvre au-dessus
 * d'eux, avec la réplique en japonais, sa traduction et la voix d'Aoi Yuuki.
 *  - Mao Mao : une de ses extases devant un poison (« これ…毒です », « ああ…この苦みが… »…) ;
 *  - Jinshi : il scintille (kirakira), puis Mao Mao le regarde comme une limace ;
 *  - la lune : 毛毛, le chat ;
 *  - taper « poison » (hors d'un champ) : la grande extase, sur son monologue du fugu.
 * Monté une fois, layout racine ; rien ne se passe sous un autre thème.
 */

type Reaction = { video: string; jp: string; fr: string; voice?: string; ms: number };

const V = (name: string) => `/apothicaire/${name}.mp4`;
const A = (name: string) => `/audio/apothicaire-${name}.mp3`;

const MAOMAO: Reaction[] = [
  {
    video: V("mao-poison"),
    jp: "これ…毒です",
    fr: "Ceci… c'est du poison.",
    voice: A("kore-doku"),
    ms: 3800,
  },
  {
    video: V("mao-ecstasy"),
    jp: "ああ…この苦みが…",
    fr: "Ah… cette amertume…",
    voice: A("nigami"),
    ms: 5200,
  },
  {
    video: V("mao-fugu"),
    jp: "フグの毒…ああ、食べたい",
    fr: "Le poison du fugu… ah, j'en voudrais.",
    voice: A("fugu"),
    ms: 6600,
  },
  {
    video: V("mao-sparkle"),
    jp: "なんて愛らしい",
    fr: "Qu'ils sont adorables… (des serpents)",
    voice: A("airashii"),
    ms: 3800,
  },
];
const JINSHI: Reaction = {
  video: V("jinshi-kirakira"),
  jp: "どうした、薬屋？",
  fr: "Qu'y a-t-il, petite apothicaire ?",
  ms: 1900,
};
const SLUG: Reaction = {
  video: V("mao-slug"),
  jp: "はあ",
  fr: "(le regard qu'elle réserve aux limaces)",
  voice: A("haa"),
  ms: 3200,
};
const CAT: Reaction = { video: V("cat-maomao"), jp: "毛毛", fr: "Maomao, le chat", ms: 4200 };
const ECSTASY: Reaction = {
  video: V("mao-rainbow"),
  jp: "好んで毒を食らうのは私くらいか… たまらないんだよ",
  fr: "Il n'y a bien que moi pour manger du poison par plaisir… c'est irrésistible.",
  voice: A("monologue"),
  ms: 13800,
};
const SECRET = "poison";
const POSTERS = [...MAOMAO, JINSHI, SLUG, CAT, ECSTASY].map((r) => r.video.replace(".mp4", ".jpg"));

// Éléments où un clic garde son sens habituel.
const INTERACTIVE =
  "a, button, input, textarea, select, label, summary, canvas, [role='button'], [contenteditable]";
const PAD = 16; // hitbox un peu plus large que les personnages

const isApothicaire = () => document.documentElement.dataset.theme === "apothicaire";
const within = (el: Element | null, x: number, y: number) => {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return x >= r.left - PAD && x <= r.right + PAD && y >= r.top - PAD && y <= r.bottom + PAD;
};

type Card = Reaction & {
  id: number;
  // ancre : centre horizontal, et bord bas (au-dessus du personnage) ou haut (sous la lune)
  x: number;
  y: number;
  below?: boolean;
  big?: boolean;
};
type Sparkle = { id: number; x: number; y: number; size: number; delay: number };

export function ApothicaireFx() {
  const [cards, setCards] = useState<Card[]>([]);
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);
  const busy = useRef(false);
  const voice = useRef<HTMLAudioElement | null>(null);
  const timers = useRef(new Set<number>());

  useEffect(() => {
    const later = (ms: number, fn: () => void) => {
      const t = window.setTimeout(() => {
        timers.current.delete(t);
        fn();
      }, ms);
      timers.current.add(t);
    };
    let nextId = 1;
    let lastMaomao = -1;

    const say = (src?: string) => {
      voice.current?.pause();
      const volume = effectiveVolume();
      if (!src || volume <= 0) return;
      const a = new Audio(src);
      a.volume = Math.min(1, volume);
      void a.play().catch(() => {});
      voice.current = a;
    };
    const open = (reaction: Reaction, anchor: Omit<Card, keyof Reaction | "id">) => {
      const id = nextId++;
      setCards((list) => [...list, { ...reaction, ...anchor, id }]);
      say(reaction.voice);
      later(reaction.ms, () => setCards((list) => list.filter((c) => c.id !== id)));
    };
    const above = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top - 6 };
    };

    const clickMaomao = (el: Element) => {
      let i = Math.floor(Math.random() * MAOMAO.length);
      if (i === lastMaomao) i = (i + 1) % MAOMAO.length;
      lastMaomao = i;
      const reaction = MAOMAO[i] as Reaction;
      busy.current = true;
      open(reaction, above(el));
      later(Math.min(reaction.ms, 2600), () => (busy.current = false));
    };
    const clickJinshi = (el: Element) => {
      busy.current = true;
      const r = el.getBoundingClientRect();
      // étincelles autour de son visage
      setSparkles(
        Array.from({ length: 14 }, (_, i) => ({
          id: nextId++,
          x: r.left + r.width * (0.1 + Math.random() * 0.8),
          y: r.top + r.height * (Math.random() * 0.45),
          size: 10 + Math.random() * 18,
          delay: i * 60,
        })),
      );
      later(2200, () => setSparkles([]));
      open(JINSHI, above(el));
      // … et Mao Mao, à côté, le regarde comme une limace
      later(1800, () => {
        const mao = document.querySelector(".apo-maomao");
        if (mao) open(SLUG, above(mao));
      });
      later(3600, () => (busy.current = false));
    };
    const clickMoon = (el: Element) => {
      busy.current = true;
      const r = el.getBoundingClientRect();
      open(CAT, { x: r.left + r.width / 2, y: r.bottom + 10, below: true });
      later(2000, () => (busy.current = false));
    };
    const ecstasy = () => {
      busy.current = true;
      open(ECSTASY, { x: window.innerWidth / 2, y: window.innerHeight / 2, big: true });
      later(ECSTASY.ms, () => (busy.current = false));
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || busy.current || !isApothicaire()) return;
      if (e.target instanceof Element && e.target.closest(INTERACTIVE)) return;
      const { clientX: x, clientY: y } = e;
      const maomao = document.querySelector(".apo-maomao");
      const jinshi = document.querySelector(".apo-jinshi");
      const moon = document.querySelector(".apo-moon");
      // Mao Mao est devant Jinshi : elle d'abord
      if (within(maomao, x, y)) clickMaomao(maomao as Element);
      else if (within(jinshi, x, y)) clickJinshi(jinshi as Element);
      else if (within(moon, x, y)) clickMoon(moon as Element);
    };
    // le mot secret, tapé hors d'un champ
    let typed = "";
    const onKey = (e: KeyboardEvent) => {
      if (!isApothicaire() || e.key.length !== 1) return;
      if (e.target instanceof Element && e.target.closest("input, textarea, [contenteditable]")) {
        return;
      }
      typed = (typed + e.key.toLowerCase()).slice(-SECRET.length);
      if (typed === SECRET && !busy.current) {
        typed = "";
        ecstasy();
      }
    };
    const onHide = () => {
      if (!document.hidden) return;
      voice.current?.pause();
      setCards([]);
      busy.current = false;
    };

    if (isApothicaire()) void preloadImages(POSTERS);
    // en capture : certaines zones (le jeu TROIS…) arrêtent la propagation du clic
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onHide);
    const pending = timers.current;
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onHide);
      for (const t of pending) window.clearTimeout(t);
      voice.current?.pause();
    };
  }, []);

  if (!cards.length && !sparkles.length) return null;

  const closeBig = () => {
    voice.current?.pause();
    setCards((list) => list.filter((c) => !c.big));
    busy.current = false;
  };

  return createPortal(
    <>
      {sparkles.map((s) => (
        <span
          key={s.id}
          aria-hidden
          className="apo-sparkle"
          style={
            {
              left: s.x,
              top: s.y,
              "--sparkle-size": `${s.size}px`,
              animationDelay: `${s.delay}ms`,
            } as CSSProperties
          }
        />
      ))}
      {cards.map((c) => {
        const vignette = (
          <figure
            className={cx("apo-card", c.big && "apo-card-big", c.below && "apo-card-below")}
            style={
              c.big
                ? undefined
                : {
                    // centrée sur le personnage, sans sortir de l'écran
                    left: Math.min(Math.max(c.x, 130), window.innerWidth - 130),
                    ...(c.below ? { top: c.y } : { bottom: window.innerHeight - c.y }),
                  }
            }
          >
            <video
              src={c.video}
              poster={c.video.replace(".mp4", ".jpg")}
              autoPlay
              muted
              loop
              playsInline
              className="apo-card-video"
            />
            <figcaption>
              <span lang="ja" className="apo-card-jp">
                {c.jp}
              </span>
              <span className="apo-card-fr">{c.fr}</span>
            </figcaption>
          </figure>
        );
        return c.big ? (
          <div
            key={c.id}
            className="apo-ecstasy"
            role="dialog"
            aria-label={c.fr}
            onClick={closeBig}
          >
            {vignette}
          </div>
        ) : (
          <div key={c.id} role="status" aria-live="polite">
            {vignette}
          </div>
        );
      })}
    </>,
    document.body,
  );
}
