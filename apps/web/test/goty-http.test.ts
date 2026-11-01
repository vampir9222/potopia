import { FakeDiscord, fakeUser, OTHER_GUILD_ID, signInWithDiscord } from "@app/core/testing";
import { db } from "@app/db";
import { truncateTestDb } from "@app/db/testing";
import {
  createEdition,
  setEditionMembers,
  type MemberSnapshot,
  type PresentationSnapshot,
} from "@app/goty";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as route from "@/app/api/goty/[...path]/route";

const discord = new FakeDiscord();
const ADMIN = "100000000000000001",
  MEMBER = "100000000000000002";
let cookie = "";
const endpoints = [
  ["GET", "editions"],
  ["POST", "editions"],
  ["GET", "catalog?q=jeux"],
  ["GET", "editions/inconnue"],
  ["GET", "editions/inconnue/presentation"],
  ["GET", "editions/inconnue/eligible-members"],
  ["PUT", "editions/inconnue/members"],
  ["POST", "editions/inconnue/prepare"],
  ["POST", "editions/inconnue/proposals"],
  ["PUT", "editions/inconnue/proposals/proposition/vote"],
  ["POST", "editions/inconnue/rounds"],
  ["POST", "editions/inconnue/games"],
  ["PATCH", "editions/inconnue/games/jeu"],
  ["DELETE", "editions/inconnue/games/jeu"],
  ["PUT", "editions/inconnue/top"],
  ["PUT", "editions/inconnue/choices/rubrique"],
  ["PUT", "editions/inconnue/predictions/rubrique/cible"],
  ["PUT", "editions/inconnue/order"],
  ["POST", "editions/inconnue/control"],
  ["POST", "editions/inconnue/import-preview?format=csv"],
] as const;
type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
function call(method: Method, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const url = new URL(`http://localhost:3000/api/goty/${path}`);
  return route[method](
    new Request(url, {
      method,
      headers: {
        cookie,
        origin: "http://localhost:3000",
        "content-type": "application/json",
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    { params: Promise.resolve({ path: url.pathname.slice("/api/goty/".length).split("/") }) },
  );
}
async function signIn(discordId = ADMIN) {
  discord.add(fakeUser(discordId));
  cookie = (await signInWithDiscord(discordId)).headers.get("cookie") ?? "";
  return (await db.user.findUniqueOrThrow({ where: { discordId } })).id;
}
beforeAll(() => discord.install());
afterAll(() => discord.uninstall());
afterEach(() => vi.unstubAllEnvs());
beforeEach(async () => {
  await truncateTestDb();
  discord.users.clear();
  cookie = "";
});

describe("Accès aux routes GOTY", () => {
  it("joue une édition HTTP complète, puis retire et réactive le module sans altérer les archives", async () => {
    vi.stubEnv("GOTY_ENABLED", "true");
    vi.stubEnv("IGDB_CLIENT_ID", "");
    vi.stubEnv("IGDB_CLIENT_SECRET", "");
    const accounts = [];
    for (const discordId of [ADMIN, MEMBER, "100000000000000003", "100000000000000004"]) {
      const id = await signIn(discordId);
      accounts.push({ id, discordId, cookie });
    }
    const [admin, member, presenter, outsider] = accounts;
    if (!admin || !member || !presenter || !outsider) throw new Error("Comptes fictifs absents");
    cookie = admin.cookie;
    const created = await call("POST", "editions", {
      year: 2151,
      name: "Recette complète fictive",
    });
    expect(created.status).toBe(201);
    const { id: editionId } = (await created.json()) as { id: string };
    const base = `editions/${editionId}`;
    const read = async (account = admin) => {
      cookie = account.cookie;
      const response = await call("GET", base);
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toContain("no-store");
      return (await response.json()) as MemberSnapshot;
    };
    const television = async () => {
      const response = await call("GET", `${base}/presentation`);
      expect(response.status).toBe(200);
      const data = (await response.json()) as PresentationSnapshot;
      expect(data).not.toHaveProperty("permissions");
      expect(data.rounds.every((round) => !("eligibleUsers" in round))).toBe(true);
      return data;
    };
    const command = async (body: object) => {
      const state = await read();
      return call("POST", `${base}/control`, { expectedVersion: state.edition.version, ...body });
    };
    expect((await read()).rounds).toHaveLength(14);
    expect(
      (
        await call("PUT", `${base}/members`, {
          expectedVersion: 1,
          members: [admin, member, presenter].map((account) => ({
            userId: account.id,
            organizer: account.id === admin.id,
            presenter: account.id !== member.id,
          })),
        })
      ).status,
    ).toBe(200);
    cookie = member.cookie;
    const proposal = await call("POST", `${base}/proposals`, { name: "Prix de recette" });
    expect(proposal.status).toBe(201);
    const { id: proposalId } = (await proposal.json()) as { id: string };
    for (const account of [admin, member, presenter]) {
      cookie = account.cookie;
      expect(
        (await call("PUT", `${base}/proposals/${proposalId}/vote`, { favor: true })).status,
      ).toBe(200);
      expect((await call("GET", "catalog?q=Jeu")).status).toBe(200);
      const path = `${base}/import-preview`;
      const preview = await route.POST(
        new Request(`http://localhost:3000/api/goty/${path}?format=csv`, {
          method: "POST",
          headers: { cookie, origin: "http://localhost:3000" },
          body: `Titre;Plateforme\nJeu ${account.id} A;PC\nJeu ${account.id} B;PC`,
        }),
        { params: Promise.resolve({ path: path.split("/") }) },
      );
      expect(preview.status).toBe(200);
      const batch = (await preview.json()) as { valid: boolean; games: { title: string }[] };
      expect(batch.valid).toBe(true);
      expect((await call("POST", `${base}/games`, { games: batch.games })).status).toBe(201);
    }
    const preparation = await read();
    expect(
      (await call("POST", `${base}/prepare`, { expectedVersion: preparation.edition.version }))
        .status,
    ).toBe(200);
    const prepared = await read();
    expect(prepared.rounds).toHaveLength(15);
    const prize = prepared.rounds.find((r) => r.name === "Coup de cœur");
    const music = prepared.rounds.find((r) => r.soundtrack);
    if (!prize || !music) throw new Error("Prix de base absents");
    for (const account of [admin, member, presenter]) {
      const state = await read(account);
      const games = state.games.filter((game) => game.userId === account.id);
      expect((await call("PUT", `${base}/top`, { gameIds: games.map((g) => g.id) })).status).toBe(
        200,
      );
      for (const round of [prize, music])
        expect(
          (
            await call("PUT", `${base}/choices/${round.id}`, {
              gameId: games[0]?.id,
              precision: `SECRET-${account.id}`,
              youtube: round.soundtrack ? "https://youtu.be/abcdefghijk" : null,
            })
          ).status,
        ).toBe(200);
    }
    const allGames = (await read()).games.filter((g) => g.userId === admin.id);
    for (const [account, game] of [
      [member, allGames[0]],
      [presenter, allGames[1]],
    ] as const) {
      cookie = account.cookie;
      expect(
        (await call("PUT", `${base}/predictions/${prize.id}/${admin.id}`, { gameId: game?.id }))
          .status,
      ).toBe(200);
    }
    for (const account of [admin, member, presenter]) {
      const state = await read(account);
      expect(state.choices.every((choice) => choice.userId === account.id)).toBe(true);
      expect((await television()).choices).toEqual([]);
      expect((await television()).games).toEqual([]);
    }
    cookie = outsider.cookie;
    expect((await call("GET", base)).status).toBe(403);
    expect((await call("GET", `${base}/presentation`)).status).toBe(403);
    let raced = false;
    for (const round of prepared.rounds) {
      expect((await command({ action: "announce", roundId: round.id })).status).toBe(200);
      expect((await command({ action: "lock", roundId: round.id })).status).toBe(200);
      while (true) {
        const state = await read();
        const current = state.rounds.find((r) => r.id === round.id);
        if (!current || current.revealedCount === current.eligibleCount) break;
        const body = {
          action: "reveal",
          roundId: round.id,
          expectedVersion: state.edition.version,
        };
        if (!raced) {
          const results = await Promise.all([
            call("POST", `${base}/control`, body),
            call("POST", `${base}/control`, body),
          ]);
          expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
          raced = true;
        } else expect((await call("POST", `${base}/control`, body)).status).toBe(200);
        const tv = await television();
        expect(
          tv.choices.every((choice) =>
            tv.rounds.find((r) => r.id === choice.roundId)?.revealedUsers.includes(choice.userId),
          ),
        ).toBe(true);
        expect(
          tv.games.every((game) => tv.choices.some((choice) => choice.gameId === game.id)),
        ).toBe(true);
      }
      expect((await command({ action: "recap", roundId: round.id })).status).toBe(200);
    }
    expect(raced).toBe(true);
    expect((await command({ action: "close" })).status).toBe(200);
    const archived = await read(outsider);
    expect(archived.edition.phase).toBe("closed");
    expect(archived.standings?.find((entry) => entry.id === member.id)?.points).toBe(1);
    expect(archived.standings?.find((entry) => entry.id === presenter.id)?.points).toBe(0);
    cookie = admin.cookie;
    expect(
      (await call("POST", `${base}/games`, { games: [{ title: "Interdit après clôture" }] }))
        .status,
    ).toBe(409);
    const count = await db.notification.count();
    expect(JSON.stringify(await db.notification.findMany())).not.toMatch(
      /SECRET-|youtu|Prix de recette|Jeu /,
    );
    expect(await db.activityEvent.count()).toBe(0);
    vi.stubEnv("GOTY_ENABLED", "false");
    for (const path of ["editions", base, `${base}/presentation`])
      expect((await call("GET", path)).status).toBe(404);
    expect(
      (
        await call("POST", `${base}/control`, {
          action: "restart",
          confirmRestart: true,
          expectedVersion: archived.edition.version,
        })
      ).status,
    ).toBe(404);
    vi.stubEnv("GOTY_ENABLED", "true");
    expect((await read(outsider)).edition).toEqual(archived.edition);
    expect(await db.notification.count()).toBe(count);
    await db.session.deleteMany({ where: { userId: member.id } });
    cookie = member.cookie;
    expect((await call("GET", base)).status).toBe(401);
    await signIn(member.discordId);
    expect((await call("GET", base)).status).toBe(200);
  }, 30000);
  it.each(endpoints)(
    "%s %s refuse sans session avant toute lecture du corps",
    async (method, path) => {
      const response = await call(method, path);
      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toContain("no-store");
    },
  );
  it("révoque un ex-membre avant d’autoriser la consultation TV", async () => {
    await signIn(MEMBER);
    const user = discord.users.get(MEMBER);
    if (user) user.guilds = [OTHER_GUILD_ID];
    await db.session.updateMany({ data: { guildCheckedAt: new Date(0) } });
    expect((await call("GET", "editions/inconnue/presentation")).status).toBe(403);
  });
  it("refuse origine absente, origine étrangère et contexte cross-site sans écrire", async () => {
    await signIn();
    const origins: Record<string, string>[] = [
      { origin: "" },
      { origin: "https://example.test" },
      { "sec-fetch-site": "cross-site" },
    ];
    for (const headers of origins) {
      expect((await call("POST", "editions", { year: 2150, name: "Test" }, headers)).status).toBe(
        403,
      );
    }
    expect(await db.gotyEdition.count()).toBe(0);
  });
  it("distingue route inconnue et requête malformée sans détailler des données privées", async () => {
    await signIn();
    expect((await call("GET", "inconnue")).status).toBe(404);
    expect((await call("POST", "editions", { year: "invalide" })).status).toBe(400);
    expect((await call("POST", "editions", { name: "x".repeat(2 * 1024 * 1024) })).status).toBe(
      400,
    );
  });
});

describe("Contrats HTTP des parcours GOTY", () => {
  it("ne réutilise jamais la révision d’un autre membre ayant les mêmes permissions", async () => {
    const first = await signIn(MEMBER);
    const secondDiscord = "100000000000000003";
    const second = await signIn(secondDiscord);
    const actorId = await signIn();
    const edition = await createEdition({ actorId, year: 2150, name: "Deux lecteurs" });
    await setEditionMembers({
      actorId,
      editionId: edition.id,
      expectedVersion: 1,
      members: [
        { userId: first, organizer: false, presenter: false },
        { userId: second, organizer: false, presenter: false },
      ],
    });
    await signIn(MEMBER);
    const initial = await call("GET", `editions/${edition.id}`);
    const tag = initial.headers.get("etag") ?? "";
    await signIn(secondDiscord);
    const response = await call("GET", `editions/${edition.id}`, undefined, {
      "if-none-match": tag,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("etag")).not.toBe(tag);
    expect(response.headers.get("x-goty-viewer")).toBe(second);
  });
  it("crée et prépare une édition avec l’acteur de session, importe et classe ses jeux", async () => {
    const actorId = await signIn();
    const response = await call("POST", "editions", {
      year: 2150,
      name: "Soirée fictive",
      actorId: "usurpation",
    });
    expect(response.status).toBe(201);
    const { id: editionId } = await response.json();
    expect(
      await db.gotyMember.findUnique({
        where: { editionId_userId: { editionId, userId: actorId } },
      }),
    ).not.toBeNull();
    expect(
      (
        await call("POST", `editions/${editionId}/games`, {
          games: [{ title: "Jeu A", completed: true }, { title: "Jeu B" }],
        })
      ).status,
    ).toBe(201);
    const state = await (await call("GET", `editions/${editionId}`)).json();
    expect(state.games[0].completed).toBe(true);
    expect(
      (
        await call("POST", `editions/${editionId}/prepare`, {
          expectedVersion: state.edition.version,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await call("PUT", `editions/${editionId}/top`, {
          gameIds: state.games.map((g: { id: string }) => g.id),
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await call("PATCH", `editions/${editionId}/games/${state.games[0].id}`, {
          title: "Jeu modifié",
          completed: false,
        })
      ).status,
    ).toBe(200);
    const fresh = await (await call("GET", `editions/${editionId}`)).json();
    const first = fresh.rounds[0];
    expect(
      (
        await call("POST", `editions/${editionId}/control`, {
          expectedVersion: fresh.edition.version,
          action: "announce",
          roundId: first.id,
        })
      ).status,
    ).toBe(200);
    expect(
      (await call("PUT", `editions/${editionId}/choices/${first.id}`, { gameId: null })).status,
    ).toBe(409);
  });
  it("filtre TV, utilise des révisions privées et vérifie l’accès avant un 304", async () => {
    const actorId = await signIn();
    const edition = await createEdition({ actorId, year: 2150, name: "Édition privée" });
    const member = await call("GET", `editions/${edition.id}`);
    const tag = member.headers.get("etag") ?? "";
    expect(member.headers.get("cache-control")).toContain("no-store");
    expect(
      (await call("GET", `editions/${edition.id}`, undefined, { "if-none-match": tag })).status,
    ).toBe(304);
    const tv = await (await call("GET", `editions/${edition.id}/presentation`)).json();
    expect(tv).not.toHaveProperty("permissions");
    expect(tv.games).toEqual([]);
    await signIn(MEMBER);
    expect(
      (await call("GET", `editions/${edition.id}`, undefined, { "if-none-match": tag })).status,
    ).toBe(403);
  });
  it("réserve les candidats à l’organisation et borne la prévisualisation des imports", async () => {
    const memberId = await signIn(MEMBER);
    const actorId = await signIn();
    const edition = await createEdition({ actorId, year: 2150, name: "Import" });
    await setEditionMembers({
      actorId,
      editionId: edition.id,
      expectedVersion: 1,
      members: [
        { userId: actorId, organizer: true, presenter: true },
        { userId: memberId, organizer: false, presenter: false },
      ],
    });
    await signIn(MEMBER);
    expect((await call("GET", `editions/${edition.id}/eligible-members`)).status).toBe(403);
    const path = ["editions", edition.id, "import-preview"];
    const preview = (body: string) =>
      route.POST(
        new Request(`http://localhost:3000/api/goty/${path.join("/")}?format=csv`, {
          method: "POST",
          headers: { origin: "http://localhost:3000", cookie },
          body,
        }),
        { params: Promise.resolve({ path }) },
      );
    const response = await preview("Titre;Terminé\nJeu fictif;oui");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      valid: true,
      games: [{ title: "Jeu fictif", completed: true }],
    });
    expect((await preview("x".repeat(5 * 1024 * 1024 + 1))).status).toBe(400);
    expect(await db.gotyGame.count()).toBe(0);
  });
});
