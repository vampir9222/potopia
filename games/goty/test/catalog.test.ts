import { db } from "@app/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchCatalog } from "../src/catalog";
import { selectTrailer } from "../src/catalog";
import { U, X, setupEdition } from "./fixtures";

const TOKEN = "faux-jeton-fournisseur";
const rows = [
  {
    id: 12,
    name: "Jeu du catalogue",
    cover: { image_id: "cover_1" },
    platforms: [{ name: "PC" }],
    videos: [
      { name: "Soundtrack", video_id: "abcdefghijk" },
      { name: "Launch trailer", video_id: "0123456789_" },
    ],
  },
];
let fetcher: ReturnType<typeof vi.fn<typeof fetch>>;
beforeEach(async () => {
  await setupEdition();
  vi.setSystemTime(new Date("2150-01-01T12:00:00Z"));
  vi.stubEnv("IGDB_CLIENT_ID", "client-fictif");
  vi.stubEnv("IGDB_CLIENT_SECRET", crypto.randomUUID());
  fetcher = vi.fn<typeof fetch>(async (input) =>
    String(input).includes("oauth2/token")
      ? Response.json({ access_token: TOKEN, expires_in: 3600 })
      : Response.json(rows),
  );
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Catalogue IGDB côté serveur", () => {
  it("fonctionne sans clés et valide acteur et longueur avant tout appel", async () => {
    vi.stubEnv("IGDB_CLIENT_SECRET", "");
    expect(await searchCatalog({ actorId: U, query: "Jeu" })).toEqual({
      games: [],
      available: false,
    });
    await expect(searchCatalog({ actorId: U, query: "x" })).rejects.toMatchObject({ status: 400 });
    await expect(searchCatalog({ actorId: "inconnu", query: "Jeu" })).rejects.toMatchObject({
      status: 403,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("projette les résultats, partage le cache et ne persiste aucun secret", async () => {
    const result = await searchCatalog({ actorId: U, query: "Jeu" });
    expect(result).toEqual({
      available: true,
      games: [
        {
          igdbId: 12,
          title: "Jeu du catalogue",
          cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/cover_1.jpg",
          platforms: ["PC"],
          trailerYoutubeId: "0123456789_",
        },
      ],
    });
    expect(await searchCatalog({ actorId: X, query: "JEU" })).toEqual(result);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const stored = JSON.stringify(await db.gotyCatalogCache.findMany());
    expect(stored).not.toContain(TOKEN);
    expect(stored).not.toContain(process.env.IGDB_CLIENT_SECRET);
  });
  it("reprend un cache d’une autre instance sans authentification fournisseur", async () => {
    await searchCatalog({ actorId: U, query: "Jeu" });
    vi.stubEnv("IGDB_CLIENT_SECRET", "autre-instance-fictive");
    fetcher.mockRejectedValue(new Error("aucun réseau"));
    expect((await searchCatalog({ actorId: X, query: "Jeu" })).games).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("renouvelle les entrées expirées et les jetons expirés", async () => {
    fetcher.mockImplementation(async (input) =>
      String(input).includes("oauth2/token")
        ? Response.json({ access_token: TOKEN, expires_in: 1 })
        : Response.json(rows),
    );
    await searchCatalog({ actorId: U, query: "Jeu" });
    await db.gotyCatalogCache.updateMany({ data: { expiresAt: new Date("2000-01-01") } });
    await searchCatalog({ actorId: U, query: "Jeu" });
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it("applique le quota membre même sur cache et le quota fournisseur sur les recherches distinctes", async () => {
    await searchCatalog({ actorId: U, query: "Jeu" });
    for (let i = 0; i < 29; i++) await searchCatalog({ actorId: U, query: "Jeu" });
    await expect(searchCatalog({ actorId: U, query: "Jeu" })).rejects.toMatchObject({
      status: 429,
    });
    for (const query of ["Deux", "Trois", "Quatre"]) await searchCatalog({ actorId: X, query });
    await expect(searchCatalog({ actorId: X, query: "Cinq" })).rejects.toMatchObject({
      status: 429,
    });
    vi.setSystemTime(new Date("2150-01-01T12:01:01Z"));
    expect((await searchCatalog({ actorId: U, query: "Cinq" })).available).toBe(true);
  });
  it("borne la recherche et retire les séparateurs du langage IGDB", async () => {
    await searchCatalog({ actorId: U, query: 'Jeu"; fields *;\\\n' });
    const body = String(fetcher.mock.calls[1]?.[1]?.body);
    expect(body).toMatch(/^search "Jeu fields \*";/);
    expect(body).toContain("limit 12;");
    expect(fetcher.mock.calls.every(([, options]) => options?.signal instanceof AbortSignal)).toBe(
      true,
    );
  });
  it.each([401, 429, 500])(
    "traduit une erreur fournisseur %i sans exposer son contenu",
    async (status) => {
      fetcher.mockImplementation(async (input) =>
        String(input).includes("oauth2/token")
          ? Response.json({ access_token: TOKEN, expires_in: 3600 })
          : new Response("contenu privé du fournisseur", { status }),
      );
      await expect(searchCatalog({ actorId: U, query: "Jeu" })).rejects.toMatchObject({
        status: 503,
        code: "CATALOG_UNAVAILABLE",
      });
      expect(await db.gotyCatalogCache.count()).toBe(0);
    },
  );
  it("traite délai réseau, jeton malformé et métadonnées malformées", async () => {
    fetcher.mockRejectedValue(new Error("timeout privé"));
    await expect(searchCatalog({ actorId: U, query: "Jeu" })).rejects.toMatchObject({
      status: 503,
    });
    fetcher.mockResolvedValue(Response.json({ incorrect: true }));
    await expect(searchCatalog({ actorId: U, query: "Jeu" })).rejects.toMatchObject({
      status: 503,
    });
    fetcher.mockImplementation(async (input) =>
      String(input).includes("oauth2/token")
        ? Response.json({ access_token: TOKEN, expires_in: 3600 })
        : Response.json([{ id: 12, name: "Jeu", cover: { image_id: "../interdit" } }]),
    );
    await expect(searchCatalog({ actorId: U, query: "Jeu" })).rejects.toMatchObject({
      status: 503,
    });
  });
  it("choisit un trailer identifié plutôt qu’une musique ou un identifiant incorrect", () => {
    expect(
      selectTrailer([
        { name: "Teaser", video_id: "abcdefghijk" },
        { name: "Launch Trailer", video_id: "0123456789_" },
        { name: "Trailer", video_id: "incorrect" },
      ]),
    ).toBe("0123456789_");
    expect(selectTrailer([{ name: "Music", video_id: "abcdefghijk" }])).toBeNull();
  });
});
