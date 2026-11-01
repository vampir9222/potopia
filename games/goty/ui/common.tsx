"use client";
import { Modal } from "@app/ui";
import { ExternalLink, Film, Gamepad2, Trophy } from "lucide-react";
import { useState } from "react";
import { YoutubePlayer } from "./YoutubePlayer";
export { YoutubePlayer } from "./YoutubePlayer";
import type { MemberSnapshot } from "../src/snapshot";

export type Game = MemberSnapshot["games"][number];
export const PHASE_LABELS = {
  categories: "Les catégories",
  preparation: "La préparation",
  live: "La soirée",
  closed: "Les archives",
};
export function PhaseSteps({ phase }: { phase: keyof typeof PHASE_LABELS }) {
  const current = Object.keys(PHASE_LABELS).indexOf(phase);
  return (
    <ol className="goty-steps" aria-label="Étapes de l’édition">
      {Object.entries(PHASE_LABELS).map(([key, title], index) => (
        <li
          key={key}
          aria-current={phase === key ? "step" : undefined}
          className={index <= current ? "is-reached" : ""}
        >
          <span>{String(index + 1).padStart(2, "0")}</span>
          {title}
        </li>
      ))}
    </ol>
  );
}
export function Cover({
  game,
  large = false,
}: {
  game: Pick<Game, "title" | "cover">;
  large?: boolean;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <div className={large ? "goty-cover goty-cover-large" : "goty-cover"}>
      {game.cover && failed !== game.cover ? (
        <img
          src={game.cover}
          alt={`Jaquette de ${game.title}`}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(game.cover)}
        />
      ) : (
        <Gamepad2 size={large ? 64 : 32} aria-hidden />
      )}
    </div>
  );
}
export function Trailer({ game, onOpen }: { game: Game; onOpen?: () => void }) {
  const [open, setOpen] = useState(false);
  const search = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${game.title} trailer`)}`;
  return (
    <>
      <button
        className="goty-text-button"
        onClick={() => {
          onOpen?.();
          setOpen(true);
        }}
      >
        <Film size={15} /> Voir le trailer
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={game.title}>
        {open &&
          (game.trailerYoutubeId ? (
            <YoutubePlayer videoId={game.trailerYoutubeId} />
          ) : (
            <p>Aucun trailer intégré pour ce jeu.</p>
          ))}
        <a className="goty-external" href={search} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={15} /> Chercher sur YouTube si la vidéo est indisponible
        </a>
      </Modal>
    </>
  );
}
export function Standings({ entries }: { entries: MemberSnapshot["standings"] }) {
  if (!entries)
    return (
      <p className="goty-muted">Le classement sera visible quand le présentateur l’affichera.</p>
    );
  return (
    <ol className="goty-standings">
      {entries.map((entry) => (
        <li key={entry.id}>
          <span className="goty-rank">{entry.rank === 1 ? <Trophy size={22} /> : entry.rank}</span>
          <strong>{entry.name}</strong>
          <span>
            {entry.points} <small>point{entry.points > 1 ? "s" : ""}</small>
          </span>
        </li>
      ))}
    </ol>
  );
}
