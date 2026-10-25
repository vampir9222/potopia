"use client";

import { FRAME_SIZE } from "@app/avatar-assets";
import { useEffect, useRef } from "react";
import type { SheetLayout } from "../../src/compose";
import { drawFrame, frameAt, prefersReducedMotion } from "../animation";
import { loadSheet } from "../browser";
import { CLICK_LINES, reactionsFor, type PlaceEvent } from "./reactions";
import { cx } from "@app/ui";
import {
  buildScene,
  drawBubble,
  drawGround,
  drawProp,
  MIN_SCENE_HEIGHT,
  type Scene,
} from "./scene";
import { act, animationOf, createWalker, INACTIVE_AFTER_MS, say, step, type Walker } from "./sim";

export type PlaceMemberView = {
  id: string;
  name: string;
  /** URL de la planche courante (change avec l'empreinte de l'avatar). */
  sheetUrl: string;
  lastSeenAt: string;
};

export type PlaceSnapshot = { members: PlaceMemberView[]; events: PlaceEvent[]; now: string };

type Props = {
  initial: PlaceSnapshot;
  layout: SheetLayout;
  /** Route qui renvoie un `PlaceSnapshot` (`?since=` : événements depuis cette date). */
  endpoint?: string;
  pollMs?: number;
  /** Taille du cadre (`flex-1`…) : la scène remplit sa hauteur, 280 px au moins. */
  className?: string;
};

type Confetti = { x: number; y: number; vx: number; vy: number; color: string; until: number };
type Entry = { member: PlaceMemberView; walker: Walker; sheet: ImageBitmap | null };

const CONFETTI_COLORS = ["#f4d35e", "#ee6c9a", "#5fb3e0", "#7fca86", "#9b7bf0"];

/**
 * La place : les avatars des membres se promènent sous la grille des apps. Scène décorative
 * (aria-hidden) : les mêmes informations restent accessibles dans le fil d'activité.
 */
export function Place({
  initial,
  layout,
  endpoint = "/api/place",
  pollMs = 30_000,
  className,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // `initial` et `layout` arrivent du serveur : nouveaux objets à chaque rendu (rafraîchissement
  // du routeur après une action), au contenu identique ou presque. Ils passent par des refs pour
  // que la scène ne soit pas reconstruite (avatars téléportés, planches rechargées) à chaque fois.
  const initialRef = useRef(initial);
  const layoutRef = useRef(layout);
  const applyRef = useRef<((snapshot: PlaceSnapshot) => void) | null>(null);

  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  // Nouveau rendu serveur : les membres sont mis à jour en place (un avatar modifié change de
  // planche sans bouger), les événements éventuels sont joués ; le polling continue d'où il était.
  useEffect(() => {
    if (initial === initialRef.current) return;
    initialRef.current = initial;
    applyRef.current?.(initial);
  }, [initial]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !wrap || !ctx) return;

    const reduced = prefersReducedMotion();
    const rng = Math.random;
    const entries = new Map<string, Entry>();
    let confetti: Confetti[] = [];
    let scene: Scene = buildScene(wrap.clientWidth || 600, wrap.clientHeight);
    let ground: HTMLCanvasElement | null = null;
    let since = initialRef.current.now;
    let hovered: string | null = null;
    let clock = 0;
    let last = performance.now();
    let raf = 0;

    const isAsleep = (m: PlaceMemberView) =>
      Date.now() - new Date(m.lastSeenAt).getTime() > INACTIVE_AFTER_MS;

    const setMembers = (members: PlaceMemberView[]) => {
      const ids = new Set(members.map((m) => m.id));
      for (const id of entries.keys()) if (!ids.has(id)) entries.delete(id);
      for (const member of members) {
        const entry = entries.get(member.id);
        if (entry) {
          entry.walker.asleep = isAsleep(member);
          if (entry.member.sheetUrl === member.sheetUrl) {
            entry.member = member;
            continue;
          }
          entry.member = member;
        }
        const target: Entry = entry ?? {
          member,
          walker: createWalker(member.id, scene.world, rng, isAsleep(member)),
          sheet: null,
        };
        entries.set(member.id, target);
        // Avatar modifié : nouvelle planche, sans recharger la page.
        loadSheet(member.sheetUrl)
          .then((bitmap) => {
            if (target.member.sheetUrl === member.sheetUrl) target.sheet = bitmap;
          })
          .catch(() => undefined);
      }
    };

    const burst = (x: number, y: number) => {
      if (reduced) return;
      for (let i = 0; i < 40; i++) {
        confetti.push({
          x,
          y,
          vx: (rng() - 0.5) * 160,
          vy: -60 - rng() * 140,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length] ?? "#fff",
          until: clock + 1200 + rng() * 600,
        });
      }
    };

    // Le serveur peut renvoyer deux fois le même événement (marge de 10 s sur `since`, liste
    // tronquée) : chaque réaction n'est jouée qu'une fois. Ensemble borné aux derniers ids reçus.
    const seen = new Set<string>();
    const SEEN_MAX = 200;
    const react = (events: PlaceEvent[]) => {
      for (const event of events) {
        if (seen.has(event.id)) continue;
        seen.add(event.id);
        if (seen.size > SEEN_MAX) {
          const oldest = seen.values().next().value;
          if (oldest !== undefined) seen.delete(oldest);
        }
        const walker = entries.get(event.userId)?.walker;
        if (!walker) continue;
        for (const reaction of reactionsFor(event)) {
          if (reaction.kind === "bubble") say(walker, reaction.text, clock, 4000);
          else if (reaction.kind === "confetti") burst(walker.x, walker.y - 40);
          else if (!reduced) act(walker, reaction.kind, clock);
        }
      }
    };

    const resize = () => {
      const width = Math.max(200, Math.floor(wrap.clientWidth));
      scene = buildScene(width, wrap.clientHeight);
      const { height, walk } = scene.world;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ground = document.createElement("canvas");
      ground.width = width;
      ground.height = height;
      const g = ground.getContext("2d");
      if (g) drawGround(g, scene);
      // Personnages hors de la nouvelle zone : replacés.
      for (const { walker } of entries.values()) {
        walker.x = Math.min(Math.max(walker.x, walk.x), walk.x + walk.w);
        walker.y = Math.min(Math.max(walker.y, walk.y), walk.y + walk.h);
        walker.target = null;
      }
    };

    const draw = () => {
      const dpr = canvas.width / (parseFloat(canvas.style.width) || canvas.width);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      if (ground) ctx.drawImage(ground, 0, 0);

      type Drawable = { y: number; draw: () => void };
      const drawables: Drawable[] = scene.props.map((prop) => ({
        y: prop.y,
        draw: () => drawProp(ctx, prop, clock, reduced),
      }));
      for (const { walker, sheet } of entries.values()) {
        drawables.push({
          y: walker.y,
          draw: () => {
            ctx.fillStyle = "rgb(0 0 0 / 0.25)";
            ctx.beginPath();
            ctx.ellipse(walker.x, walker.y - 1, 11, 4, 0, 0, Math.PI * 2);
            ctx.fill();
            if (!sheet) return;
            const animation = animationOf(walker);
            const layout = layoutRef.current;
            const frame = reduced ? 0 : frameAt(layout, animation, clock + walker.phase);
            // Assis : face à la caméra. Le bas de la frame LPC touche les pieds à ~2 px du bord.
            const direction = walker.asleep && !walker.action ? "down" : walker.direction;
            drawFrame(
              ctx,
              sheet,
              layout,
              animation,
              direction,
              frame,
              Math.round(walker.x - FRAME_SIZE / 2),
              Math.round(walker.y - FRAME_SIZE + 2),
              1,
            );
          },
        });
      }
      // Profondeur : ce qui est plus bas sur l'écran passe devant.
      drawables.sort((a, b) => a.y - b.y);
      for (const d of drawables) d.draw();

      for (const { walker, member } of entries.values()) {
        const head = walker.y - 58;
        if (walker.bubble) drawBubble(ctx, walker.bubble.text, walker.x, head);
        else if (hovered === member.id) drawBubble(ctx, member.name, walker.x, head, "dark");
        else if (walker.asleep && !walker.action) {
          ctx.font = "bold 10px ui-sans-serif, system-ui, sans-serif";
          ctx.fillStyle = "rgb(255 255 255 / 0.85)";
          const t = reduced ? 0 : (clock / 900) % 1;
          ctx.fillText("z", walker.x + 8, head + 14 - t * 6);
          ctx.fillText("z", walker.x + 13, head + 6 - t * 6);
          ctx.fillText("Z", walker.x + 19, head - 3 - t * 6);
        }
      }

      for (const c of confetti) {
        ctx.fillStyle = c.color;
        ctx.fillRect(Math.round(c.x), Math.round(c.y), 3, 3);
      }
    };

    const tick = (now: number) => {
      // Onglet caché : requestAnimationFrame est suspendu ; au retour, pas de grand saut de temps.
      const dt = Math.min(now - last, 100);
      last = now;
      clock += dt;
      step(
        scene.world,
        [...entries.values()].map((e) => e.walker),
        clock,
        dt,
        rng,
        reduced,
      );
      confetti = confetti.filter((c) => c.until > clock);
      for (const c of confetti) {
        c.vy += 300 * (dt / 1000);
        c.x += c.vx * (dt / 1000);
        c.y += c.vy * (dt / 1000);
      }
      draw();
      raf = requestAnimationFrame(tick);
    };

    const walkerAt = (clientX: number, clientY: number): Entry | undefined => {
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      return [...entries.values()]
        .sort((a, b) => b.walker.y - a.walker.y)
        .find(({ walker }) => Math.abs(x - walker.x) < 14 && y < walker.y && y > walker.y - 50);
    };
    const onMove = (e: PointerEvent) => {
      const entry = walkerAt(e.clientX, e.clientY);
      hovered = entry?.member.id ?? null;
      canvas.style.cursor = entry ? "pointer" : "default";
    };
    const onLeave = () => {
      hovered = null;
    };
    const onClick = (e: MouseEvent) => {
      const entry = walkerAt(e.clientX, e.clientY);
      if (!entry) return;
      if (!reduced) act(entry.walker, "jump", clock);
      say(
        entry.walker,
        CLICK_LINES[Math.floor(rng() * CLICK_LINES.length)] ?? "Salut !",
        clock,
        1800,
      );
    };

    const poll = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(`${endpoint}?since=${encodeURIComponent(since)}`);
        if (!res.ok) return;
        const snapshot = (await res.json()) as PlaceSnapshot;
        since = snapshot.now;
        setMembers(snapshot.members);
        react(snapshot.events);
      } catch {
        // Réseau indisponible : nouvel essai au prochain tour.
      }
    };

    resize();
    setMembers(initialRef.current.members);
    applyRef.current = (snapshot) => {
      setMembers(snapshot.members);
      react(snapshot.events);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("click", onClick);
    const interval = window.setInterval(poll, pollMs);
    raf = requestAnimationFrame(tick);

    return () => {
      applyRef.current = null;
      cancelAnimationFrame(raf);
      window.clearInterval(interval);
      observer.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("click", onClick);
    };
  }, [endpoint, pollMs]);

  return (
    <div
      ref={wrapRef}
      aria-hidden
      style={{ minHeight: MIN_SCENE_HEIGHT }}
      className={cx("rounded-theme relative overflow-hidden border border-(--frame)", className)}
    >
      {/* En absolu : le canvas ne pousse pas son cadre, qui garde la hauteur que lui donne la page. */}
      <canvas
        ref={canvasRef}
        height={MIN_SCENE_HEIGHT}
        className="absolute inset-0 block"
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  );
}
