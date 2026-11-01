// @vitest-environment happy-dom
// @vitest-environment-options {"happyDOM":{"settings":{"disableIframePageLoading":true,"disableJavaScriptFileLoading":true,"handleDisabledFileLoadingAsSuccess":true}}}
import { act } from "react";
import type * as SharedUi from "@app/ui";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Cover } from "../ui/common";
import { YoutubePlayer } from "../ui/YoutubePlayer";

const media = vi.hoisted(() => ({
  release: vi.fn(),
  claim: vi.fn(),
  volume: { level: 0.25, muted: false },
}));
vi.mock("@app/ui", async (load) => ({
  ...(await load<typeof SharedUi>()),
  claimMediaFocus: media.claim,
  useVolume: () => media.volume,
}));
type Player = InstanceType<NonNullable<Window["YT"]>["Player"]>;
type Options = ConstructorParameters<NonNullable<Window["YT"]>["Player"]>[1];
let options: Options;
let instance: Player;
let root: Root;
let container: HTMLDivElement;
let hidden: boolean;
let state: number;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  media.claim.mockReturnValue(media.release);
  media.volume = { level: 0.25, muted: false };
  hidden = false;
  state = 1;
  instance = {
    setVolume: vi.fn(),
    playVideo: vi.fn(),
    pauseVideo: vi.fn(),
    getPlayerState: () => state,
    destroy: vi.fn(),
  };
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
  window.YT = {
    Player: class {
      setVolume = instance.setVolume;
      playVideo = instance.playVideo;
      pauseVideo = instance.pauseVideo;
      getPlayerState = instance.getPlayerState;
      destroy = instance.destroy;
      constructor(_frame: HTMLIFrameElement, events: Options) {
        options = events;
      }
    },
  };
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  document.querySelector('script[src="https://www.youtube.com/iframe_api"]')?.remove();
  delete window.YT;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const mount = async () => act(async () => root.render(<YoutubePlayer videoId="abcdefghijk" />));

it("applique le volume avant la lecture et ne réinitialise pas le lecteur à chaque volume", async () => {
  await mount();
  const frame = container.querySelector("iframe");
  expect(frame?.referrerPolicy).toBe("strict-origin-when-cross-origin");
  expect(frame?.src).toContain("youtube-nocookie.com/embed/abcdefghijk?");
  expect(frame?.src).toContain("origin=");
  expect(frame?.src).toContain("autoplay=0");
  expect(instance.playVideo).not.toHaveBeenCalled();
  await act(async () => options.events.onReady({ target: instance }));
  expect(instance.setVolume).toHaveBeenCalledWith(25);
  expect(vi.mocked(instance.setVolume).mock.invocationCallOrder[0]).toBeLessThan(
    vi.mocked(instance.playVideo).mock.invocationCallOrder[0] ?? 0,
  );
  media.volume = { level: 0.8, muted: true };
  await mount();
  expect(instance.setVolume).toHaveBeenLastCalledWith(0);
  expect(instance.playVideo).toHaveBeenCalledTimes(1);
  await act(async () => root.render(null));
  expect(instance.destroy).toHaveBeenCalledOnce();
  expect(media.release).toHaveBeenCalledOnce();
  expect(container.querySelector("iframe")).toBeNull();
});

it("reprend après masquage uniquement une vidéo qui jouait et signale les blocages", async () => {
  await mount();
  await act(async () => options.events.onReady({ target: instance }));
  hidden = true;
  document.dispatchEvent(new Event("visibilitychange"));
  expect(instance.pauseVideo).toHaveBeenCalledOnce();
  hidden = false;
  document.dispatchEvent(new Event("visibilitychange"));
  expect(instance.playVideo).toHaveBeenCalledTimes(2);
  state = 2;
  hidden = true;
  document.dispatchEvent(new Event("visibilitychange"));
  hidden = false;
  document.dispatchEvent(new Event("visibilitychange"));
  expect(instance.playVideo).toHaveBeenCalledTimes(2);
  await act(async () => options.events.onAutoplayBlocked());
  expect(container.textContent).toContain("Clique sur Lecture");
  await act(async () => options.events.onError());
  expect(container.textContent).toContain("Vidéo indisponible");
});

it("ne crée aucun lecteur si l’API arrive après fermeture et rend la main en cas de blocage", async () => {
  delete window.YT;
  vi.useFakeTimers();
  await mount();
  expect(document.querySelector('script[src="https://www.youtube.com/iframe_api"]')).not.toBeNull();
  await act(async () => vi.advanceTimersByTime(10000));
  expect(container.textContent).toContain("Vidéo indisponible");
  await act(async () => root.render(null));
  expect(media.release).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});

it("remplace une jaquette cassée sans bloquer le jeu et réessaie une nouvelle URL", async () => {
  await act(async () =>
    root.render(
      <Cover game={{ title: "Jeu fictif", cover: "https://images.igdb.com/cover.jpg" }} />,
    ),
  );
  await act(async () => container.querySelector("img")?.dispatchEvent(new Event("error")));
  expect(container.querySelector("img")).toBeNull();
  expect(container.querySelector("svg")).not.toBeNull();
  await act(async () =>
    root.render(<Cover game={{ title: "Jeu fictif", cover: "https://images.igdb.com/new.jpg" }} />),
  );
  expect(container.querySelector("img")?.getAttribute("referrerpolicy")).toBe("no-referrer");
});
