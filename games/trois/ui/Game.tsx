"use client";

import { preloadImages, toBeContinued } from "@app/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  dayStarted,
  GRACE_MINUTES,
  GRACE_MS,
  normalize,
  shareText,
  WORD_LEN,
  type DayView,
  type Mark,
  type WordView,
} from "../src/game";
import { api } from "./api";
import { feedSecret } from "./Boobzilla";
import { Menacing, MENACING_SRC } from "./Menacing";
import { confetti } from "./confetti";
import type { Stats } from "./Profile";
import { sfx } from "./sound";

/** Mot vide, pour un créneau hors limites (ne devrait pas arriver). */
const EMPTY_WORD: WordView = { status: "playing", tries: 0, marks: [] };

const ROWS = ["azertyuiop", "qsdfghjklm", "wxcvbn"];
// texte sombre sur les cases colorées (le blanc n'atteint pas 4,5:1 sur le vert ni sur l'orange)
const TILE: Record<Mark, string> = {
  correct: "bg-good border-good text-zinc-900",
  present: "bg-near border-near text-zinc-900",
  absent: "bg-miss border-miss text-white",
};
const RANK: Record<Mark, number> = { absent: 0, present: 1, correct: 2 };
const FLIP_STEP = 120;
const REVEAL_MS = WORD_LEN * FLIP_STEP + 400;
// alerte avant minuit : à partir de 23h45
const WARN_MS = 15 * 60_000;
const PRAISE = ["Génial !", "Magnifique !", "Splendide !", "Bravo !", "Pas mal !", "Ouf !"];

/** Mode test : un mot déjà terminé qu'on rejoue pour de faux (rien n'est enregistré). */
type Practice = { slot: number; guesses: string[]; marks: Mark[][] };

function practiceView(p: Practice, maxTries: number, answer?: string): WordView {
  const last = p.marks.at(-1);
  const status = last?.every((m) => m === "correct")
    ? "won"
    : p.guesses.length >= maxTries
      ? "lost"
      : "playing";
  return {
    status,
    tries: p.guesses.length,
    marks: p.marks,
    guesses: p.guesses,
    answer: status === "playing" ? undefined : answer,
  };
}

/** Mot trouvé : les cases sautent, une gerbe de confettis, et la grande fanfare pour un 3 sur 3. */
function celebrate(perfect: boolean) {
  if (perfect) {
    sfx.perfect();
    confetti({ big: true });
  } else {
    sfx.win();
    confetti();
  }
}

/** Un son par case, synchronisé avec l'animation de retournement. */
const playReveal = (marks: Mark[]) =>
  marks.forEach((m, i) => sfx.tile(m, (i * FLIP_STEP + 250) / 1000));

/**
 * La journée affichée. Le parent la monte avec `key={day.date}` : au changement de jour tout
 * l'état local (mot affiché, saisie, mode test) repart de zéro.
 */
export function Game({
  day,
  onUpdate,
  onNewDay,
  onSkipToToday,
  onShowLeaderboard,
  onOutcome,
}: {
  day: DayView;
  onUpdate: (d: DayView, s?: Stats) => void;
  /** La journée affichée n'est plus celle du serveur : à recharger. */
  onNewDay: () => void;
  /** Délai de grâce : laisser tomber la journée d'hier pour jouer les nouveaux mots. */
  onSkipToToday: () => void;
  onShowLeaderboard: () => void;
  /** Un mot vient d'être trouvé ou perdu (entraînement compris), à la fin de l'animation. */
  onOutcome?: (outcome: "won" | "lost") => void;
}) {
  const current = day.words.findIndex((w) => w.status === "playing");
  const [view, setView] = useState(current === -1 ? day.words.length - 1 : current);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [revealing, setRevealing] = useState<{ slot: number; row: number } | null>(null);
  const [practice, setPractice] = useState<Practice | null>(null);
  const [dancing, setDancing] = useState<{ slot: number; row: number } | null>(null);

  const real = day.words[view] ?? EMPTY_WORD;
  const word = practice ? practiceView(practice, day.maxTries, real.answer) : real;
  // créneau dans lequel on tape : le mot rejoué en mode test, sinon le mot en cours
  const active = practice ? view : current;
  const playable = !busy && !revealing && view === active && word.status === "playing";
  // dernier essai du mot en cours, ou du mot rejoué en mode test : ゴゴゴゴ
  const lastChance =
    view === active && word.status === "playing" && word.tries === day.maxTries - 1;

  const flash = useCallback((msg: string, ms = 1600) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), ms);
  }, []);

  const fail = useCallback(
    (msg: string) => {
      sfx.error();
      setShake(true);
      flash(msg);
    },
    [flash],
  );

  const dance = useCallback((slot: number, row: number) => {
    setDancing({ slot, row });
    setTimeout(() => setDancing(null), WORD_LEN * 100 + 600);
  }, []);

  const startPractice = (slot: number) => {
    sfx.click();
    setInput("");
    setPractice({ slot, guesses: [], marks: [] });
  };

  const stopPractice = () => {
    sfx.click();
    setInput("");
    setPractice(null);
  };

  const submit = useCallback(async () => {
    if (!playable) return;
    if (input.length < WORD_LEN) return fail("Pas assez de lettres");
    setBusy(true);
    try {
      if (practice) {
        const r = await api("/api/trois/practice", { body: { guess: input, slot: practice.slot } });
        const next = {
          ...practice,
          guesses: [...practice.guesses, input],
          marks: [...practice.marks, r.marks],
        };
        const row = practice.guesses.length;
        setPractice(next);
        setRevealing({ slot: view, row });
        setInput("");
        playReveal(r.marks);
        const w = practiceView(next, day.maxTries, real.answer);
        setTimeout(() => {
          setRevealing(null);
          if (w.status === "won") {
            onOutcome?.("won");
            celebrate(false);
            dance(view, row);
            flash(PRAISE[row] ?? "Bravo !");
          }
          if (w.status === "lost") {
            onOutcome?.("lost");
            sfx.lose();
            flash(`C'était « ${w.answer?.toUpperCase()} »`, 2500);
            toBeContinued();
          }
        }, REVEAL_MS);
        return;
      }

      // le serveur fait tout : validation du mot + feedback lettre par lettre
      // la journée jouée part avec l'essai : après minuit, le serveur ne la compte jamais pour la
      // nouvelle journée (il l'accepte pendant le délai de grâce, sinon 409 et on recharge)
      const r = await api("/api/trois/guess", {
        body: { guess: input, slot: current, date: day.date },
      });
      if (r.day.date !== day.date) return onNewDay();
      const row = r.day.words[r.slot].tries - 1;
      setRevealing({ slot: r.slot, row });
      setInput("");
      onUpdate(r.day, r.stats);
      playReveal(r.marks);
      const w = r.day.words[r.slot];
      const perfect = r.day.over && r.day.words.every((x: WordView) => x.status === "won");
      setTimeout(() => {
        setRevealing(null);
        if (w.status === "won") {
          onOutcome?.("won");
          celebrate(perfect);
          dance(r.slot, row);
          flash(perfect ? "Trois sur trois ! 🏆" : (PRAISE[row] ?? "Bravo !"));
        }
        if (w.status === "lost") {
          onOutcome?.("lost");
          sfx.lose();
          flash(`C'était « ${w.answer?.toUpperCase()} »`, 2500);
          toBeContinued();
        }
        if (w.status !== "playing" && r.slot < r.day.words.length - 1)
          setTimeout(() => setView(r.slot + 1), 1200);
      }, REVEAL_MS);
    } catch (e) {
      fail((e as Error).message);
      // 409 : l'état affiché ne correspond plus au serveur (mot en cours d'hier après minuit,
      // journée finie sur un autre appareil, essai en double) : on recharge la journée
      if ((e as { status?: number }).status === 409) onNewDay();
    } finally {
      setBusy(false);
    }
  }, [
    playable,
    input,
    practice,
    view,
    day.date,
    day.maxTries,
    real.answer,
    current,
    onUpdate,
    onNewDay,
    flash,
    fail,
    dance,
  ]);

  const press = useCallback(
    (k: string) => {
      if (!playable) return;
      if (k === "enter") return void submit();
      if (k === "back") {
        if (input) sfx.back();
        return setInput((s) => s.slice(0, -1));
      }
      const l = normalize(k);
      if (l.length === 1 && input.length < WORD_LEN) {
        sfx.key();
        setInput((s) => (s.length < WORD_LEN ? s + l : s));
      }
    },
    [playable, submit, input],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Enter") press("enter");
      else if (e.key === "Backspace") press("back");
      else if (/^\p{L}$/u.test(e.key)) press(e.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  // « ゴゴゴゴ » chargé d'avance : au dernier essai, il surgit sans attendre l'image
  useEffect(() => void preloadImages([MENACING_SRC]), []);

  // le mot secret ne doit pas rester dans la grille
  useEffect(() => {
    const clear = () => setInput("");
    window.addEventListener("boobzilla", clear);
    return () => window.removeEventListener("boobzilla", clear);
  }, []);

  useEffect(() => {
    if (shake) {
      const t = setTimeout(() => setShake(false), 500);
      return () => clearTimeout(t);
    }
  }, [shake]);

  // couleurs du clavier : la meilleure info connue pour chaque lettre (mot affiché)
  const keyColors = useMemo(() => {
    const m: Record<string, Mark> = {};
    word.guesses?.forEach((g, r) => {
      if (revealing && revealing.slot === view && revealing.row === r) return;
      [...g].forEach((l, i) => {
        const mark = word.marks[r]?.[i];
        if (!mark) return;
        const known = m[l];
        if (!known || RANK[mark] > RANK[known]) m[l] = mark;
      });
    });
    return m;
  }, [word, revealing, view]);

  return (
    <div className="relative flex flex-1 flex-col items-center gap-4 px-2 pt-4 pb-3">
      {toast && (
        <div className="animate-toast absolute top-14 left-1/2 z-20 rounded-lg bg-zinc-100 px-4 py-2 font-semibold text-zinc-900 shadow-lg">
          {toast}
        </div>
      )}

      {!day.over && !practice && (
        <Deadline day={day} onNewDay={onNewDay} onSkipToToday={onSkipToToday} />
      )}

      {/* sélecteur des 3 mots */}
      <div className="flex gap-2">
        {day.words.map((w, i) => {
          const locked = current !== -1 && i > current;
          return (
            <button
              key={i}
              disabled={locked}
              onClick={() => {
                sfx.click();
                setPractice(null);
                setInput("");
                setView(i);
              }}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                view === i ? "border-zinc-200 bg-zinc-800" : "border-zinc-800"
              } ${locked ? "opacity-40" : "hover:border-zinc-500"}`}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  w.status === "won"
                    ? "bg-good"
                    : w.status === "lost"
                      ? "bg-red-500"
                      : i === current
                        ? "bg-near"
                        : "bg-zinc-600"
                }`}
              />
              Mot {i + 1}
              {locked && " 🔒"}
            </button>
          );
        })}
      </div>

      {/* mode test */}
      {practice ? (
        <div className="border-near/60 bg-near/10 flex w-full max-w-sm items-center justify-between gap-2 rounded-xl border border-dashed px-3 py-2 text-sm">
          <span>
            🧪 <b>Mode test</b> <span className="text-zinc-400">· rien n&apos;est enregistré</span>
          </span>
          <span className="flex gap-1">
            <button
              onClick={() => celebrate(true)}
              title="Écouter la fanfare du 3 sur 3"
              className="rounded-lg bg-zinc-800 px-2 py-1 hover:bg-zinc-700"
            >
              🎺
            </button>
            {word.status !== "playing" && (
              <button
                onClick={() => startPractice(view)}
                className="rounded-lg bg-zinc-800 px-2 py-1 hover:bg-zinc-700"
              >
                Rejouer
              </button>
            )}
            <button
              onClick={stopPractice}
              className="rounded-lg bg-zinc-800 px-2 py-1 hover:bg-zinc-700"
            >
              Quitter
            </button>
          </span>
        </div>
      ) : (
        real.status !== "playing" && (
          <button
            onClick={() => startPractice(view)}
            className="rounded-full border border-dashed border-zinc-700 px-3 py-1 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
          >
            🧪 Rejouer ce mot pour de faux
          </button>
        )
      )}

      {/* grille ; au dernier essai d'un mot, ambiance menaçante façon JoJo */}
      <div className="relative grid gap-1.5">
        {lastChance && <Menacing />}
        {Array.from({ length: day.maxTries }, (_, r) => {
          const guess = word.guesses?.[r];
          const typing = !guess && r === word.tries && view === active ? input : "";
          const isRevealing = revealing?.slot === view && revealing.row === r;
          const isDancing = dancing?.slot === view && dancing.row === r;
          return (
            <div
              key={r}
              className={`grid grid-cols-5 gap-1.5 ${shake && view === active && r === word.tries ? "animate-shake" : ""} ${lastChance && r === word.tries ? "trois-last-row" : ""}`}
            >
              {Array.from({ length: WORD_LEN }, (_, i) => {
                const letter = guess?.[i] ?? typing[i] ?? "";
                const mark = guess ? word.marks[r]?.[i] : undefined;
                return (
                  <div
                    key={i}
                    style={
                      isRevealing
                        ? { animationDelay: `${i * FLIP_STEP}ms` }
                        : isDancing
                          ? { animationDelay: `${i * 100}ms` }
                          : undefined
                    }
                    className={`grid h-14 w-14 place-items-center rounded-md border-2 text-3xl font-bold uppercase sm:h-16 sm:w-16 ${
                      mark ? TILE[mark] : letter ? "animate-pop border-zinc-500" : "border-zinc-800"
                    } ${isRevealing ? "animate-flip" : isDancing ? "animate-dance" : ""}`}
                  >
                    {letter}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {word.status !== "playing" && word.answer && (
        <p className="text-sm text-zinc-400">
          Mot {view + 1} : <b className="tracking-widest text-zinc-100 uppercase">{word.answer}</b>
          {word.status === "won"
            ? ` en ${word.tries} essai${word.tries > 1 ? "s" : ""}`
            : " — raté"}
          {practice && " (test)"}
        </p>
      )}

      {day.over && !practice ? (
        <DayOver
          day={day}
          onNewDay={onNewDay}
          onShowLeaderboard={onShowLeaderboard}
          flash={flash}
        />
      ) : (
        <Keyboard colors={keyColors} onKey={press} disabled={!playable} />
      )}
    </div>
  );
}

function Keyboard({
  colors,
  onKey,
  disabled,
}: {
  colors: Record<string, Mark>;
  onKey: (k: string) => void;
  disabled: boolean;
}) {
  return (
    <div
      className={`mt-auto flex w-full flex-col gap-1.5 select-none ${disabled ? "opacity-70" : ""}`}
    >
      {ROWS.map((row, ri) => (
        <div key={ri} className="flex justify-center gap-1">
          {ri === 2 && (
            <Key wide onClick={() => onKey("enter")}>
              Entrée
            </Key>
          )}
          {[...row].map((l) => (
            <Key
              key={l}
              mark={colors[l]}
              onClick={() => {
                feedSecret(l);
                onKey(l);
              }}
            >
              {l}
            </Key>
          ))}
          {ri === 2 && (
            <Key wide onClick={() => onKey("back")}>
              ⌫
            </Key>
          )}
        </div>
      ))}
    </div>
  );
}

function Key({
  children,
  mark,
  wide,
  onClick,
}: {
  children: React.ReactNode;
  mark?: Mark;
  wide?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-14 rounded-md text-sm font-bold uppercase transition active:scale-95 ${
        wide ? "flex-[1.6] px-1 text-xs" : "max-w-11 flex-1"
      } ${
        // lettre absente : fond nettement plus sombre qu'une touche pas encore jouée, mais lettre
        // encore lisible (zinc-400 sur zinc-900 = 6,7:1)
        mark === "absent"
          ? "border-zinc-900 bg-zinc-900 text-zinc-400"
          : mark
            ? TILE[mark]
            : "bg-zinc-700 text-zinc-100"
      }`}
    >
      {children}
    </button>
  );
}

const mmss = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * Bandeau de fin de journée. Avant minuit (dès 23h45) : le temps qui reste. Après minuit, une
 * journée commencée reste jouable jusqu'à 00h30 (délai de grâce) : le temps qui reste, et de quoi
 * passer aux nouveaux mots. Une fois la journée close, on charge la nouvelle.
 */
function Deadline({
  day,
  onNewDay,
  onSkipToToday,
}: {
  day: DayView;
  onNewDay: () => void;
  onSkipToToday: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const asked = useRef(0);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const started = dayStarted(day);
  const deadline = started ? day.endsAt + GRACE_MS : day.endsAt;
  // journée close : nouveaux mots (réessayé toutes les 30 s si le chargement échoue)
  useEffect(() => {
    if (now < deadline || now - asked.current < 30_000) return;
    asked.current = now;
    onNewDay();
  }, [now, deadline, onNewDay]);

  if (now >= deadline) return null;
  const afterMidnight = now >= day.endsAt;
  if (!afterMidnight && day.endsAt - now > WARN_MS) return null;

  return (
    <div className="border-near/60 bg-near/10 flex w-full max-w-sm flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm">
      <span>
        {afterMidnight ? (
          <>
            🌙 Minuit est passé : encore <b className="font-mono">{mmss(deadline - now)}</b> pour
            finir TROIS #{day.number}
          </>
        ) : started ? (
          <>
            ⏳ Nouveaux mots dans <b className="font-mono">{mmss(day.endsAt - now)}</b>
            <span className="text-zinc-400">
              {" "}
              · tu auras jusqu&apos;à 00h{String(GRACE_MINUTES).padStart(2, "0")} pour finir
              celle-ci
            </span>
          </>
        ) : (
          <>
            ⏳ Plus que <b className="font-mono">{mmss(day.endsAt - now)}</b> pour jouer TROIS #
            {day.number}
          </>
        )}
      </span>
      {afterMidnight && (
        <button
          onClick={() => {
            sfx.click();
            onSkipToToday();
          }}
          className="rounded-lg bg-zinc-800 px-2 py-1 hover:bg-zinc-700"
        >
          Passer aux nouveaux mots
        </button>
      )}
    </div>
  );
}

/** Heure de Paris : date au format AAAA-MM-JJ et secondes restantes avant minuit. */
function parisClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const p = (t: string) => parts.find((x) => x.type === t)?.value ?? "00";
  return {
    date: `${p("year")}-${p("month")}-${p("day")}`,
    left: 86400 - (Number(p("hour")) * 3600 + Number(p("minute")) * 60 + Number(p("second"))),
  };
}

function DayOver({
  day,
  onNewDay,
  onShowLeaderboard,
  flash,
}: {
  day: DayView;
  onNewDay: () => void;
  onShowLeaderboard: () => void;
  flash: (m: string) => void;
}) {
  const [left, setLeft] = useState("");
  // journée finie après minuit, pendant le délai de grâce : on laisse voir le résultat, les
  // nouveaux mots attendent un clic
  const [late] = useState(() => parisClock().date !== day.date);
  useEffect(() => {
    if (late) return;
    let asked = 0;
    const tick = () => {
      const clock = parisClock();
      // minuit est passé (compte à rebours à zéro, ou onglet resté ouvert sans tic à 00:00:00) :
      // on affiche 00:00:00 et on charge les nouveaux mots (réessayé toutes les 30 s si ça échoue)
      if (clock.date !== day.date) {
        setLeft("00:00:00");
        if (Date.now() - asked > 30_000) {
          asked = Date.now();
          onNewDay();
        }
        return;
      }
      const s = clock.left;
      const pad = (x: number) => String(x).padStart(2, "0");
      setLeft(`${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [day.date, onNewDay, late]);

  const found = day.words.filter((w) => w.status === "won").length;

  async function share() {
    const text = shareText(day, `${location.origin}/trois`);
    try {
      if (navigator.share && /Mobi|Android/i.test(navigator.userAgent))
        await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        sfx.success();
        flash("Résultat copié !");
      }
    } catch {
      /* partage annulé */
    }
  }

  return (
    <div className="mt-auto w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 text-center">
      <p className="text-lg font-bold">
        {found === 3
          ? "Trois sur trois ! 🏆"
          : found === 0
            ? "Journée difficile… 😅"
            : `${found}/3 mots trouvés`}
      </p>
      <div className="mt-2 flex justify-center gap-2 text-sm text-zinc-400">
        {day.words.map((w, i) => (
          <span key={i} className="tracking-widest uppercase">
            {w.answer}
            {i < 2 && " ·"}
          </span>
        ))}
      </div>
      {late ? (
        <button
          onClick={() => {
            sfx.click();
            onNewDay();
          }}
          className="mt-4 w-full rounded-xl border border-zinc-600 py-3 font-semibold hover:border-zinc-400"
        >
          Jouer les nouveaux mots
        </button>
      ) : (
        <>
          <p className="mt-4 text-xs tracking-wide text-zinc-400 uppercase">Prochains mots dans</p>
          <p className="font-mono text-3xl">{left}</p>
        </>
      )}
      <div className="mt-4 flex gap-2">
        <button
          onClick={share}
          className="bg-good flex-1 rounded-xl py-3 font-semibold text-zinc-900"
        >
          Partager
        </button>
        <button
          onClick={onShowLeaderboard}
          className="flex-1 rounded-xl bg-zinc-700 py-3 font-semibold"
        >
          Classement
        </button>
      </div>
    </div>
  );
}
