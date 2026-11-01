// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PresentationSnapshot } from "../src/snapshot";
import { useSnapshot } from "../ui/useSnapshot";

const initial: PresentationSnapshot = {
  edition: {
    id: "edition-a",
    year: 2150,
    name: "Édition A",
    phase: "preparation",
    version: 1,
    screen: { mode: "waiting", roundId: null, audio: null },
  },
  members: [],
  games: [],
  rounds: [],
  choices: [],
  predictions: [],
  standings: null,
};
const reply = (snapshot = initial, viewer = "viewer-a") =>
  Response.json(snapshot, {
    headers: {
      etag: `"${snapshot.edition.id}-${snapshot.edition.version}"`,
      "x-goty-viewer": viewer,
    },
  });
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
let root: Root;
let container: HTMLDivElement;
let fetcher: ReturnType<typeof vi.fn<typeof fetch>>;
let current: ReturnType<typeof useSnapshot<PresentationSnapshot>> | null;
let hidden: boolean;
function Harness({
  value = initial,
  viewer = "viewer-a",
}: {
  value?: PresentationSnapshot;
  viewer?: string;
}) {
  current = useSnapshot(value, viewer, true);
  return (
    <div>
      {current.snapshot?.edition.name ?? "État vidé"}
      <span>{current.error}</span>
    </div>
  );
}
function state() {
  if (!current) throw new Error("Composant absent");
  return current;
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  hidden = false;
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
  fetcher = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetcher);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  current = null;
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Synchronisation React GOTY", () => {
  it("ne remplace pas une mutation par une ancienne réponse de lecture, même si le réseau ignore l’annulation", async () => {
    const old = deferred<Response>();
    const updated = {
      ...initial,
      edition: { ...initial.edition, version: 2, name: "Après mutation" },
    };
    fetcher
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(Response.json({ ok: true }))
      .mockResolvedValueOnce(reply(updated));
    await act(async () => root.render(<Harness />));
    const signal = fetcher.mock.calls[0]?.[1]?.signal;
    await act(async () => {
      expect(await state().mutate("control", "POST", { action: "reveal" })).toBe(true);
    });
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      old.resolve(reply(initial));
    });
    expect(state().snapshot?.edition.version).toBe(2);
    expect(container.textContent).toContain("Après mutation");
  });
  it("efface l’état si le compte change et bloque toute nouvelle écriture de cette vue", async () => {
    fetcher.mockResolvedValue(reply(initial, "viewer-b"));
    await act(async () => root.render(<Harness />));
    expect(state().snapshot).toBeNull();
    expect(container.textContent).toContain("Le compte connecté a changé");
    expect(await state().mutate("top", "PUT", {})).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([401, 403, 404])(
    "vide la vue sur %s (session, inscription ou retrait du module)",
    async (status) => {
      fetcher.mockResolvedValue(Response.json({ error: { message: "Accès refusé" } }, { status }));
      await act(async () => root.render(<Harness />));
      expect(state().snapshot).toBeNull();
      expect(container.textContent).toContain("Accès refusé");
    },
  );
  it("annule les requêtes de l’ancienne édition au changement de clé", async () => {
    const old = deferred<Response>();
    const next = {
      ...initial,
      edition: { ...initial.edition, id: "edition-b", name: "Édition B" },
    };
    fetcher.mockReturnValueOnce(old.promise).mockResolvedValueOnce(reply(next));
    await act(async () => root.render(<Harness key="a" />));
    const signal = fetcher.mock.calls[0]?.[1]?.signal;
    await act(async () => root.render(<Harness key="b" value={next} />));
    await act(async () => {
      old.resolve(reply(initial));
    });
    expect(signal?.aborted).toBe(true);
    expect(state().snapshot?.edition.id).toBe("edition-b");
  });
  it("suspend le polling hors écran et rafraîchit au retour sans décoder une réponse 304", async () => {
    vi.useFakeTimers();
    fetcher
      .mockResolvedValueOnce(reply())
      .mockImplementation(
        async () => new Response(null, { status: 304, headers: { "x-goty-viewer": "viewer-a" } }),
      );
    await act(async () => root.render(<Harness />));
    hidden = true;
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(9000);
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    hidden = false;
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(state().snapshot?.edition.version).toBe(1);
  });
});
