import { db } from "@app/db";
import {
  addGames,
  controlEdition,
  getEdition,
  listGames,
  setChoice,
  type ControlInput,
} from "../src/index";
import { O, P, U, openPreparation, setupEdition } from "./fixtures";

type CommandOnly<T> = T extends unknown
  ? Omit<T, "actorId" | "editionId" | "expectedVersion">
  : never;
export type Command = CommandOnly<ControlInput>;

export async function setupCeremony() {
  const editionId = await setupEdition();
  for (const [actorId, titles] of [
    [U, ["Jeu U1", "Jeu U2"]],
    [P, ["Jeu P1", "Jeu P2"]],
    [O, ["Jeu O1"]],
  ] as const) {
    await addGames({ actorId, editionId, games: titles.map((title) => ({ title })) });
  }
  const games = await listGames({ actorId: U, editionId });
  const gameId = (title: string) => {
    const game = games.find((g) => g.title === title);
    if (!game) throw new Error("Jeu de fixture absent");
    return game.id;
  };
  const rows = await db.gotyRound.findMany({
    where: {
      editionId,
      name: { in: ["Coup de cœur", "Meilleure bande-son", "Meilleur gameplay"] },
    },
    orderBy: { position: "asc" },
  });
  await db.gotyRound.deleteMany({ where: { editionId, id: { notIn: rows.map((r) => r.id) } } });
  for (const [position, round] of rows.entries())
    await db.gotyRound.update({ where: { id: round.id }, data: { position } });
  const [first, music, empty] = rows;
  if (!first || !music || !empty) throw new Error("Rubriques de fixture absentes");
  await openPreparation(editionId);
  for (const actorId of [U, P]) {
    await setChoice({
      actorId,
      editionId,
      roundId: first.id,
      gameId: gameId(actorId === U ? "Jeu U1" : "Jeu P1"),
      precision: actorId === U ? "SECRET_U" : "SECRET_P",
    });
    await setChoice({
      actorId,
      editionId,
      roundId: music.id,
      gameId: gameId(actorId === U ? "Jeu U2" : "Jeu P2"),
      youtube: actorId === U ? "https://youtu.be/abcdefghijk" : "https://youtu.be/0123456789_",
    });
  }
  const access = (actorId = P) => ({ actorId, editionId });
  const version = async () => (await getEdition(access())).edition.version;
  const control = async (command: Command, actorId = P, expectedVersion?: number) =>
    controlEdition({
      ...command,
      ...access(actorId),
      expectedVersion: expectedVersion ?? (await version()),
    });
  return {
    editionId,
    first: first.id,
    music: music.id,
    empty: empty.id,
    gameId,
    access,
    version,
    control,
  };
}
