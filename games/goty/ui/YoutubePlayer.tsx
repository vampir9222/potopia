"use client";
import { claimMediaFocus, useVolume } from "@app/ui";
import { useEffect, useRef, useState } from "react";

type Player = {
  setVolume: (volume: number) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  getPlayerState: () => number;
  destroy: () => void;
};
type PlayerOptions = {
  events: {
    onReady: (event: { target: Player }) => void;
    onError: () => void;
    onAutoplayBlocked: () => void;
  };
};
declare global {
  interface Window {
    YT?: { Player: new (frame: HTMLIFrameElement, options: PlayerOptions) => Player };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export function YoutubePlayer({ videoId }: { videoId: string }) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<Player | null>(null);
  const ready = useRef(false);
  const volume = useVolume();
  const latestVolume = useRef(volume);
  const [message, setMessage] = useState("");
  useEffect(() => {
    latestVolume.current = volume;
    if (ready.current) player.current?.setVolume(volume.muted ? 0 : Math.round(volume.level * 100));
  }, [volume]);
  useEffect(() => {
    const container = host.current;
    if (!container) return;
    const release = claimMediaFocus();
    let disposed = false;
    let resume = false;
    const unavailable = () => {
      if (!disposed) setMessage("Vidéo indisponible ici. Utilise le lien YouTube ci-dessous.");
    };
    const frame = document.createElement("iframe");
    const params = new URLSearchParams({
      enablejsapi: "1",
      autoplay: "0",
      playsinline: "1",
      origin: window.location.origin,
    });
    frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${params}`;
    frame.title = "Lecteur YouTube";
    frame.className = "goty-video";
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.allow = "autoplay; encrypted-media; fullscreen; picture-in-picture";
    frame.allowFullscreen = true;
    container.append(frame);
    // Charge l’API officielle uniquement lorsqu’un membre ouvre un lecteur.
    let script = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    if (!script && !window.YT?.Player) {
      script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      window.onYouTubeIframeAPIReady ??= () => {};
      document.head.append(script);
    }
    script?.addEventListener("error", unavailable);
    const start = () => {
      if (!window.YT?.Player || player.current || disposed) return false;
      player.current = new window.YT.Player(frame, {
        events: {
          onReady: ({ target }) => {
            if (disposed) return;
            ready.current = true;
            setMessage("");
            const current = latestVolume.current;
            target.setVolume(current.muted ? 0 : Math.round(current.level * 100));
            if (!document.hidden) target.playVideo();
            else resume = true;
          },
          onError: unavailable,
          onAutoplayBlocked: () => {
            if (!disposed) setMessage("Clique sur Lecture dans le lecteur pour activer le son.");
          },
        },
      });
      return true;
    };
    const poll = window.setInterval(() => {
      if (player.current || start()) window.clearInterval(poll);
    }, 100);
    start();
    const timeout = window.setTimeout(() => {
      window.clearInterval(poll);
      if (!ready.current) unavailable();
    }, 10000);
    const visibility = () => {
      if (!ready.current || !player.current) return;
      if (document.hidden) {
        resume = player.current.getPlayerState() === 1;
        if (resume) player.current.pauseVideo();
      } else if (resume) {
        resume = false;
        player.current.playVideo();
      }
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      disposed = true;
      window.clearInterval(poll);
      window.clearTimeout(timeout);
      script?.removeEventListener("error", unavailable);
      document.removeEventListener("visibilitychange", visibility);
      player.current?.destroy();
      player.current = null;
      ready.current = false;
      frame.remove();
      release();
    };
  }, [videoId]);
  return (
    <>
      <div ref={host} />
      {message && (
        <p role="status" className="goty-muted">
          {message}
        </p>
      )}
    </>
  );
}
