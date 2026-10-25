"use client";

import { Avatar, Badge, Button, Card, Input, Select, cx } from "@app/ui";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
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
    // rien de neuf, ou réponse d'un rafraîchissement parti avant un coup déjà affiché
    if (prev && next.version <= prev.version) return;
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

  // retour sur l'onglet : on recharge tout de suite plutôt que d'attendre le prochain tic
  useEffect(() => {
    if (over) return;
    const onVis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [over, load]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 5_000);
    return () => clearTimeout(t);
  }, [message]);

  /** Envoie un coup ; true s'il est passé (le formulaire d'indice ne se vide qu'alors). */
  const move = async (body: Record<string, unknown>): Promise<boolean> => {
    setBusy(true);
    setMessage(null);
    try {
      apply(await api<GameView>(`/api/agents/games/${id}`, { body }));
      setSelected(null);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erreur");
      if ((error as { status?: number }).status === 409) load();
      return false;
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
    (view.role === "guess" || view.role === "sudden") && !c.found && !c.bystanderTheirs;
  const current = view.history.findLast((h) => h.clue && h.turn === TURNS - view.turnsLeft + 1);
  const lastGuess = view.history.at(-1)?.guesses.at(-1);
  // mot qui a fait perdre : assassin, ou témoin en mort subite
  const fatal =
    view.status === "lost" && lastGuess && lastGuess.result !== "agent" ? lastGuess : null;

  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
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
                {!over && (
                  <span className="text-muted">
                    il te reste {view.partnerAgentsLeft} agent
                    {view.partnerAgentsLeft > 1 ? "s" : ""} de {view.partner.name} à trouver
                  </span>
                )}
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
            className="ag-board mx-auto grid max-w-3xl grid-cols-5 gap-2.5 p-1 sm:gap-4 sm:p-2"
            // un groupe de boutons, pas une grille ARIA (qui exigerait des lignes et des cellules)
            role="group"
            aria-label="Grille de mots"
          >
            {view.cards.map((c, i) => (
              // cartes distribuées une à une à l'arrivée : le délai ne concerne que la distribution
              <div key={i} className="ag-slot" style={{ animationDelay: `${i * 28}ms` }}>
                <WordCard
                  index={i}
                  card={c}
                  partnerName={view.partner.name}
                  showKey={showKey || over}
                  over={over}
                  fatal={fatal?.card === i ? fatal.result : null}
                  selected={selected === i}
                  flip={flipped.has(i)}
                  busy={busy}
                  onClick={canTouch(c) ? () => setSelected(selected === i ? null : i) : undefined}
                />
              </div>
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
            <span className="flex items-center gap-1.5">
              <span className="ag-legend ag-legend-agent" /> mes agents
            </span>
            <span className="flex items-center gap-1.5">
              <span className="ag-legend ag-legend-assassin" /> mes assassins
            </span>
            <span className="flex items-center gap-1.5">
              <WalkerIcon className="size-3" /> témoin (sur la carte de qui)
            </span>
            {over && <span>contour intérieur : carte de {view.partner.name}</span>}
          </div>
        </Card>
      </div>

      <aside className="flex w-full flex-col gap-4 xl:w-80">
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

/** Silhouette d'espion (chapeau et lunettes), dessinée en SVG pour rester nette à toutes les tailles. */
function SpyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M6.6 10.6 8 4.8c.2-.8 1-1.2 1.8-1l2.2.6 2.2-.6c.8-.2 1.6.2 1.8 1l1.4 5.8z" />
      <path d="M2.5 10.8h19c.3 0 .5.2.5.5s-.2.6-.5.7c-2.4.8-5.9 1.2-9.5 1.2s-7.1-.4-9.5-1.2a.7.7 0 0 1-.5-.7c0-.3.2-.5.5-.5" />
      <path d="M6.3 14.6c1.5.4 3.6.6 5.7.6s4.2-.2 5.7-.6c-.3 3.6-2.8 6.4-5.7 6.4s-5.4-2.8-5.7-6.4m2.3 1.2c0 .7.7 1.2 1.6 1.2s1.4-.5 1.4-1.2zm4.6 0c0 .7.6 1.2 1.4 1.2s1.6-.5 1.6-1.2z" />
    </svg>
  );
}

/** Silhouette de passant, pour les témoins. */
function WalkerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <circle cx="12.5" cy="4" r="2.4" />
      <path d="M10.2 7.4h3.6c.9 0 1.6.6 1.8 1.4l1.1 4.8c.1.6-.3 1.1-.9 1.1-.4 0-.8-.3-.9-.7l-.8-3.2-.6 3.4 1.6 7.4a1.1 1.1 0 0 1-2.1.5l-1.6-6-1.4 6a1.1 1.1 0 0 1-2.1-.5l1.4-7.4-.6-3.4-.8 3.2c-.1.4-.5.7-.9.7-.6 0-1-.5-.9-1.1l1.1-4.8c.2-.8.9-1.4 1.9-1.4" />
    </svg>
  );
}

function WordCard({
  card,
  index,
  partnerName,
  showKey,
  over,
  fatal,
  selected,
  flip,
  busy,
  onClick,
}: {
  card: CardView;
  index: number;
  partnerName: string;
  showKey: boolean;
  over: boolean;
  /** Ce mot a fait perdre la mission : assassin, ou témoin touché en mort subite. */
  fatal: Result | null;
  selected: boolean;
  flip: boolean;
  busy: boolean;
  /** Absent quand ce n'est pas à moi de toucher ce mot : la carte reste parcourable au clavier. */
  onClick?: () => void;
}) {
  const out = card.bystanderMine && card.bystanderTheirs;
  // face visible : carte mot, ou tuile qui la recouvre (agent trouvé, témoin des deux côtés, assassin)
  const tile = card.found ? "found" : fatal ? "fatal" : out ? "out" : null;
  const key = showKey && !tile ? card.mine : "N";
  // nom accessible complet : le mot, puis ce qu'on sait de lui
  const label = [
    card.word,
    key === "G" && "ton agent",
    key === "A" && "ton assassin",
    card.found && "agent trouvé",
    card.bystanderTheirs && `témoin pour ${partnerName}`,
    card.bystanderMine && "témoin pour toi",
    fatal === "assassin" && "assassin, mission perdue",
    fatal === "bystander" && "témoin en mort subite, mission perdue",
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-disabled={!onClick || undefined}
      aria-pressed={selected}
      aria-label={label}
      // reflets du contour décalés d'une carte à l'autre
      style={{ "--ag-delay": `-${(index * 1730) % 4500}ms` } as CSSProperties}
      className={cx(
        "ag-card",
        tile && `ag-tile ag-tile-${tile}`,
        key === "G" && "ag-key-agent",
        key === "A" && "ag-key-assassin",
        over && card.theirs === "G" && "ag-their-agent",
        over && card.theirs === "A" && "ag-their-assassin",
        onClick && "ag-touchable",
        selected && "ag-selected",
        flip && "agents-flip",
      )}
    >
      {tile ? (
        <>
          {tile === "found" && <SpyIcon className="ag-tile-icon" />}
          {tile === "out" && <WalkerIcon className="ag-tile-icon" />}
          {tile === "fatal" &&
            (fatal === "bystander" ? (
              <WalkerIcon className="ag-tile-icon" />
            ) : (
              <span className="ag-tile-icon text-2xl leading-none">💀</span>
            ))}
          {tile === "found" && <span className="ag-shine" aria-hidden />}
          <span className="ag-tile-word">{card.word}</span>
        </>
      ) : (
        <>
          <span className="ag-top" aria-hidden>
            <span
              className={cx(
                "ag-portrait",
                key === "G" && "ag-portrait-agent",
                key === "A" && "ag-portrait-assassin",
              )}
            >
              {key === "A" ? (
                <span className="text-[0.6rem] leading-none sm:text-xs">💀</span>
              ) : (
                <SpyIcon className="size-full" />
              )}
            </span>
            <span className="ag-mirror">{card.word}</span>
          </span>
          <span className="ag-label">{card.word}</span>

          {(card.bystanderMine || card.bystanderTheirs) && (
            // témoin sur la carte de qui : la sienne (je l'ai touché sur son indice) ou la mienne
            <span className="ag-witness">
              <WalkerIcon className="size-2.5 shrink-0" />
              pour {card.bystanderTheirs ? partnerName : "toi"}
            </span>
          )}
        </>
      )}
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
  onMove: (body: Record<string, unknown>) => Promise<boolean>;
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
        onSubmit={async (e) => {
          e.preventDefault();
          if (await onMove({ action: "clue", word, count: Number(count) })) setWord("");
        }}
      >
        <p className="text-sm">
          <strong>À toi de donner un indice.</strong> Fais trouver à {partner} tes agents (contour
          vert), sans le mener vers tes assassins 💀. Il t'en reste{" "}
          <strong>{view.myAgentsLeft}</strong> à faire trouver.
        </p>
        <div className="flex flex-wrap gap-2">
          <Input
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="Un seul mot"
            maxLength={30}
            aria-label="Indice"
            className="max-w-56 min-w-36 flex-1"
            autoFocus
          />
          <div className="w-20">
            <Select
              value={count}
              onChange={(e) => setCount(e.target.value)}
              aria-label="Nombre de mots"
            >
              {Array.from({ length: MAX_COUNT + 1 }, (_, n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </div>
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
      view.phase === "sudden" ? (
        <p className="text-sm">
          <strong>Mort subite !</strong> Tu as trouvé tous les agents de {partner} : c'est à{" "}
          {partner} de jouer. <span className="animate-pulse">⏳</span> Il lui reste{" "}
          <strong>{view.myAgentsLeft}</strong> des tiens à trouver.
        </p>
      ) : view.phase === "clue" ? (
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
  const [error, setError] = useState<string | null>(null);
  const again = async () => {
    setBusy(true);
    setError(null);
    try {
      const { id } = await api<{ id: string }>("/api/agents/games", {
        body: { partnerId: view.partner.id },
      });
      window.location.href = `/agents/${id}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
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
        Les deux cartes sont maintenant visibles : contour extérieur pour la tienne, intérieur pour
        celle de {view.partner.name}.
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
      {error && <p className="text-danger text-sm">{error}</p>}
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
