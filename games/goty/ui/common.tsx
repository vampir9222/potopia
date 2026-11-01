"use client";
import { claimMediaFocus, Modal, useVolume } from "@app/ui";
import { ExternalLink, Film, Gamepad2, Trophy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  return (
    <div className={large ? "goty-cover goty-cover-large" : "goty-cover"}>
      {game.cover ? (
        <img src={game.cover} alt={`Jaquette de ${game.title}`} loading="lazy" />
      ) : (
        <Gamepad2 size={large ? 64 : 32} aria-hidden />
      )}
    </div>
  );
}
export function YoutubePlayer({ videoId }: { videoId: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const volume = useVolume();
  const command = (func: string, args: unknown[] = []) =>
    frame.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args }),
      "https://www.youtube-nocookie.com",
    );
  useEffect(() => claimMediaFocus(), []);
  useEffect(() => {
    command("setVolume", [volume.muted ? 0 : Math.round(volume.level * 100)]);
  }, [volume]);
  useEffect(() => {
    const visibility = () => command(document.hidden ? "pauseVideo" : "playVideo");
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, []);
  return (
    <iframe
      ref={frame}
      title="Lecteur YouTube"
      className="goty-video"
      src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&playsinline=1&enablejsapi=1`}
      allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
      allowFullScreen
      onLoad={() => command("setVolume", [volume.muted ? 0 : Math.round(volume.level * 100)])}
    />
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
