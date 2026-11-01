import { createFakeMember } from "@app/core/testing";
import { truncateTestDb } from "@app/db/testing";
import { vi } from "vitest";
import { createEdition, getEdition, prepareEdition, setEditionMembers } from "../src/index";

export const A = "prep-admin",
  O = "prep-organizer",
  P = "prep-presenter",
  U = "prep-user",
  X = "prep-outsider";
export async function setupEdition() {
  vi.stubEnv("ADMIN_DISCORD_IDS", "123456789012345678");
  await truncateTestDb();
  for (const [index, userId] of [A, O, P, U, X].entries())
    await createFakeMember({
      id: userId,
      discordId: index === 0 ? "123456789012345678" : `88888888888888888${index}`,
      name: `Membre fictif ${index}`,
    });
  const edition = await createEdition({ actorId: A, year: 2150, name: "Préparation fictive" });
  await setEditionMembers({
    actorId: A,
    editionId: edition.id,
    expectedVersion: 1,
    members: [
      { userId: O, organizer: true, presenter: false },
      { userId: P, organizer: false, presenter: true },
      { userId: U, organizer: false, presenter: false },
    ],
  });
  return edition.id;
}
export async function openPreparation(editionId: string) {
  const { edition } = await getEdition({ actorId: O, editionId });
  return prepareEdition({ actorId: O, editionId, expectedVersion: edition.version });
}
