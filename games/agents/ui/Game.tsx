"use client";

import { Avatar, Badge, Button, Card, Input, Select, cx } from "@app/ui";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  AGENTS_TOTAL,
  MAX_COUNT,
  NAME,
  SUDDEN_TURN,
  TURNS,
  type CardView,
  type GameView,
  type Result,
  type TurnView,
} from "../src/game";
import { api } from "./api";
import { Rules } from "./Rules";

/** Rafraîchissement : vite quand on attend le partenaire, lentement sinon (abandon, etc.). */
const POLL_WAIT_MS = 4_000;
const POLL_IDLE_MS = 20_000;

const RESULT_CHIP: Record<Result, string> = {
  agent: "bg-agent text-white",
  bystander: "bg-bystander text-zinc-900",
  assassin: "bg-assassin text-white",
};

export function AgentsGame({ id }: { id: string }) {
  const [view, setView] = useState<GameView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [showKey, setShowKey] = useState(true);
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const shown = useRef<GameView | null>(null);

  const apply = useCallback((next: GameView) => {
    const prev = shown.current;
    if (prev?.version === next.version) return;
    // les cases qui viennent de changer se retournent
    const changed = new Set<number>();
    next.cards.forEach((c, i) => {
      const p = prev?.cards[i];
      if (
        p &&
        (p.found !== c.found ||
          p.bystanderMine !== c.bystanderMine ||
          p.bystanderTheirs !== c.bystanderTheirs)
      ) {
        changed.add(i);
      }
    });
    shown.current = next;
    setFlipped(changed);
    setView(next);
  }, []);

  const load = useCallback(async () => {
    try {
      apply(await api<GameView>(`/api/agents/games/${id}`));
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Erreur");
    }
  }, [id, apply]);

  useEffect(() => {
    load();
  }, [load]);

  const waiting = view?.role === "wait" || view?.role === "sudden";
  const over = view?.role === "over";
  useEffect(() => {
    if (over) return;
    const t = setInterval(
      () => document.visibilityState === "visible" && load(),
      waiting ? POLL_WAIT_MS : POLL_IDLE_MS,
    );
    return () => clearInterval(t);
  }, [waiting, over, load]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 5_000);
    return () => clearTimeout(t);
  }, [message]);

  const move = async (body: Record<string, unknown>) => {
    setBusy(true);
    setMessage(null);
    try {
      apply(await api<GameView>(`/api/agents/games/${id}`, { body }));
      setSelected(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erreur");
      if ((error as { status?: number }).status === 409) load();
    } finally {
      setBusy(false);
    }
  };

  if (!view) {
    return (
      <Card>
        <p className="text-muted text-sm">
          {loadError ?? "Chargement de la mission…"}{" "}
          {loadError && (
            <a href="/agents" className="text-accent hover:underline">
              Retour aux missions
            </a>
          )}
        </p>
      </Card>
    );
  }

  const canTouch = (c: CardView) =>
    (view.role === "guess" || view.role === "sudden") && !c.found && !c.bystanderTheirs && !busy;
  const current = view.history.findLast((h) => h.clue && h.turn === TURNS - view.turnsLeft + 1);
  const lastGuess = view.history.at(-1)?.guesses.at(-1);
  const fatal =
    view.status === "lost" && lastGuess && lastGuess.result !== "agent" ? lastGuess.card : null;

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                <Avatar name={view.me.name} src={view.me.image} size={34} />
                <Avatar name={view.partner.name} src={view.partner.image} size={34} />
              </div>
              <div>
                <h1 className="font-display text-text text-base font-semibold">{NAME}</h1>
                <p className="text-muted text-xs">Mission avec {view.partner.name}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="flex flex-col items-end gap-1">
                <span className="text-muted">
                  Tours restants : {view.phase === "sudden" ? "mort subite" : view.turnsLeft}
                </span>
                <span className="flex gap-1" aria-hidden>
                  {Array.from({ length: TURNS }, (_, i) => (
                    <span
                      key={i}
                      className={cx(
                        "size-2.5 rounded-full",
                        i < view.turnsLeft ? "bg-accent" : "bg-border",
                      )}
                    />
                  ))}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-text text-lg leading-none font-bold">
                  {AGENTS_TOTAL - view.agentsLeft}
                  <span className="text-muted text-xs font-normal"> / {AGENTS_TOTAL} agents</span>
                </span>
                <span className="text-muted">
                  {view.mistakes} témoin{view.mistakes > 1 ? "s" : ""} touché
                  {view.mistakes > 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>
        </Card>

        <StatusPanel
          view={view}
          current={current}
          busy={busy}
          selected={selected}
          message={message}
          onMove={move}
          onCancel={() => setSelected(null)}
        />

        <Card className="p-2 sm:p-3">
          <div
            className="grid grid-cols-5 gap-1.5 sm:gap-2"
            role="grid"
            aria-label="Grille de mots"
          >
            {view.cards.map((c, i) => (
              <WordCard
                key={i}
                card={c}
                partnerName={view.partner.name}
                showKey={showKey || over}
                over={over}
                fatal={fatal === i}
                selected={selected === i}
                flip={flipped.has(i)}
                onClick={canTouch(c) ? () => setSelected(selected === i ? null : i) : undefined}
              />
            ))}
          </div>
          <div className="text-muted mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs">
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={showKey}
                onChange={(e) => setShowKey(e.target.checked)}
              />
              Afficher ma carte
            </label>
            <span className="flex items-center gap-1">
              <span className="bg-agent h-1.5 w-4 rounded-full" /> mes agents
            </span>
            <span className="flex items-center gap-1">
              <span className="bg-assassin ring-danger h-1.5 w-4 rounded-full ring-1" /> mes
              assassins
            </span>
            {over && <span>bande du bas : carte de {view.partner.name}</span>}
          </div>
        </Card>
      </div>

      <aside className="flex w-full flex-col gap-4 lg:w-80">
        <History view={view} />
        <Card title="Règles">
          <Rules />
        </Card>
        {!over && (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => {
              if (window.confirm("Abandonner la mission ? Elle ne comptera pas au classement.")) {
                move({ action: "abandon" });
              }
            }}
          >
            Abandonner la mission
          </Button>
        )}
      </aside>
    </div>
  );
}

const STRIPE: Record<CardView["mine"], string> = {
  G: "bg-agent",
  A: "bg-assassin ring-1 ring-danger",
  N: "",
};

function WordCard({
  card,
  partnerName,
  showKey,
  over,
  fatal,
  selected,
  flip,
  onClick,
}: {
  card: CardView;
  partnerName: string;
  showKey: boolean;
  over: boolean;
  fatal: boolean;
  selected: boolean;
  flip: boolean;
  onClick?: () => void;
}) {
  const out = card.bystanderMine && card.bystanderTheirs;
  const tone = card.found
    ? "bg-agent border-agent text-white"
    : fatal
      ? "bg-assassin border-danger text-white"
      : out
        ? "bg-bystander/70 border-bystander text-zinc-900"
        : "bg-surface border-(--frame) text-text";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-pressed={selected}
      className={cx(
        "relative flex min-h-14 flex-col items-center justify-center overflow-hidden rounded-md border px-0.5 pt-2 pb-3 text-center transition sm:min-h-18",
        tone,
        onClick && "hover:border-accent cursor-pointer hover:-translate-y-0.5",
        !onClick && "cursor-default",
        selected && "ring-accent ring-offset-bg scale-[1.03] ring-2 ring-offset-1",
        flip && "agents-flip",
      )}
    >
      {showKey && STRIPE[card.mine] && (
        <span className={cx("absolute inset-x-0 top-0 h-1.5", STRIPE[card.mine])} aria-hidden />
      )}
      {over && card.theirs && STRIPE[card.theirs] && (
        <span
          className={cx("absolute inset-x-0 bottom-0 h-1.5", STRIPE[card.theirs])}
          aria-hidden
        />
      )}
      <span className="text-[9px] leading-tight font-semibold break-words hyphens-auto uppercase sm:text-xs md:text-sm">
        {card.word}
      </span>
      {card.found && <span className="text-[10px] sm:text-xs">🕵️</span>}
      {fatal && <span className="text-[10px] sm:text-xs">💀</span>}
      {!card.found && !out && (card.bystanderMine || card.bystanderTheirs) && (
        <span className="bg-bystander mt-0.5 rounded px-1 text-[8px] leading-tight text-zinc-900 sm:text-[10px]">
          témoin {card.bystanderTheirs ? `chez ${partnerName}` : "chez toi"}
        </span>
      )}
      <span className="sr-only">
        {showKey && card.mine === "G" && "ton agent"}
        {showKey && card.mine === "A" && "ton assassin"}
      </span>
    </button>
  );
}

function StatusPanel({
  view,
  current,
  busy,
  selected,
  message,
  onMove,
  onCancel,
}: {
  view: GameView;
  current: TurnView | undefined;
  busy: boolean;
  selected: number | null;
  message: string | null;
  onMove: (body: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [word, setWord] = useState("");
  const [count, setCount] = useState("1");
  const partner = view.partner.name;
  const target = selected === null ? null : view.cards[selected]?.word;

  const touch = target !== null && target !== undefined && (
    <div className="flex flex-wrap gap-2">
      <Button disabled={busy} onClick={() => onMove({ action: "guess", card: selected })}>
        Toucher « {target} »
      </Button>
      <Button variant="secondary" disabled={busy} onClick={onCancel}>
        Annuler
      </Button>
    </div>
  );

  let body: ReactNode;
  if (view.role === "clue") {
    body = (
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          onMove({ action: "clue", word, count: Number(count) });
          setWord("");
        }}
      >
        <p className="text-sm">
          <strong>À toi de donner un indice.</strong> Fais trouver à {partner} tes agents (bande
          verte), sans le mener vers tes assassins 💀. Il t'en reste{" "}
          <strong>{view.myAgentsLeft}</strong> à faire trouver.
        </p>
        <div className="flex flex-wrap gap-2">
          <Input
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="Un seul mot"
            maxLength={30}
            aria-label="Indice"
            className="max-w-56 flex-1"
            autoFocus
          />
          <Select
            value={count}
            onChange={(e) => setCount(e.target.value)}
            aria-label="Nombre de mots"
            className="w-20"
          >
            {Array.from({ length: MAX_COUNT + 1 }, (_, n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
          <Button type="submit" disabled={busy || !word.trim()}>
            Envoyer l'indice
          </Button>
        </div>
      </form>
    );
  } else if (view.role === "guess") {
    body = (
      <div className="flex flex-col gap-3">
        <ClueLine view={view} current={current} />
        <p className="text-muted text-sm">
          Touche les mots qui sont des agents pour {partner}. Tant que c'est un agent, tu continues
          ; un témoin termine le tour, un assassin fait perdre la mission.
        </p>
        {touch || (
          <div>
            <Button
              variant="secondary"
              disabled={busy || view.turnGuesses === 0}
              onClick={() => onMove({ action: "stop" })}
            >
              Terminer le tour
            </Button>
          </div>
        )}
      </div>
    );
  } else if (view.role === "sudden") {
    body = (
      <div className="flex flex-col gap-3">
        <p className="text-sm">
          <strong>Mort subite !</strong> Plus d'indices : touchez chacun les agents de l'autre,
          quand vous voulez. Le moindre témoin ou assassin fait perdre la mission.
        </p>
        {touch}
      </div>
    );
  } else if (view.role === "wait") {
    body =
      view.phase === "clue" ? (
        <p className="text-sm">
          <span className="animate-pulse">⏳</span> {partner} réfléchit à un indice…
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <ClueLine view={view} current={current} />
          <p className="text-muted text-sm">
            <span className="animate-pulse">⏳</span> {partner} cherche tes agents…
          </p>
        </div>
      );
  } else {
    body = <Ending view={view} />;
  }

  return (
    <Card>
      {body}
      {message && <p className="text-danger mt-3 text-sm">{message}</p>}
    </Card>
  );
}

function ClueLine({ view, current }: { view: GameView; current: TurnView | undefined }) {
  if (!current?.clue) return null;
  const mine = current.clue.seat === view.mySeat;
  return (
    <p className="text-sm">
      {mine ? "Ton indice" : `Indice de ${view.partner.name}`} :{" "}
      <span className="bg-accent/15 text-text rounded px-2 py-0.5 font-bold tracking-wide uppercase">
        {current.clue.word}
      </span>{" "}
      <span className="text-muted">· {current.clue.count}</span>
      {view.turnGuesses > 0 && (
        <span className="text-muted">
          {" "}
          · {view.turnGuesses} trouvé{view.turnGuesses > 1 ? "s" : ""}
        </span>
      )}
    </p>
  );
}

function Ending({ view }: { view: GameView }) {
  const [busy, setBusy] = useState(false);
  const again = async () => {
    setBusy(true);
    try {
      const { id } = await api<{ id: string }>("/api/agents/games", {
        body: { partnerId: view.partner.id },
      });
      window.location.href = `/agents/${id}`;
    } catch {
      setBusy(false);
    }
  };
  const title =
    view.status === "won"
      ? view.turnsUsed && view.turnsUsed > TURNS
        ? "Mission réussie en mort subite ! 🎉"
        : `Mission réussie en ${view.turnsUsed} tours ! 🎉`
      : view.status === "lost"
        ? "Mission échouée 💀"
        : "Mission abandonnée";
  return (
    <div className="flex flex-col gap-3">
      <p className="text-text text-base font-semibold">{title}</p>
      <p className="text-muted text-sm">
        Les deux cartes sont maintenant visibles : bande du haut pour la tienne, du bas pour celle
        de {view.partner.name}.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={again}>
          Nouvelle mission avec {view.partner.name}
        </Button>
        <a
          href="/agents"
          className="border-border text-text hover:bg-surface-hover inline-flex h-10 items-center rounded-md border px-4 text-sm"
        >
          Toutes mes missions
        </a>
      </div>
    </div>
  );
}

function History({ view }: { view: GameView }) {
  if (view.history.length === 0) {
    return (
      <Card title="Journal">
        <p className="text-muted text-sm">Aucun indice pour l'instant.</p>
      </Card>
    );
  }
  const name = (seat: number) => (seat === view.mySeat ? "Toi" : view.partner.name);
  return (
    <Card title="Journal">
      <ol className="flex flex-col gap-3 text-sm">
        {[...view.history].reverse().map((t) => (
          <li key={t.turn} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Badge tone={t.turn === SUDDEN_TURN ? "danger" : "neutral"}>
                {t.turn === SUDDEN_TURN ? "Mort subite" : `Tour ${t.turn}`}
              </Badge>
              {t.clue && (
                <span className="text-text">
                  {name(t.clue.seat)} : <strong className="uppercase">{t.clue.word}</strong>{" "}
                  <span className="text-muted">· {t.clue.count}</span>
                </span>
              )}
            </div>
            {t.guesses.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {t.guesses.map((g, i) => (
                  <span
                    key={i}
                    title={`${name(g.seat)} a touché`}
                    className={cx("rounded px-1.5 py-0.5 text-xs uppercase", RESULT_CHIP[g.result])}
                  >
                    {view.cards[g.card]?.word}
                  </span>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}
