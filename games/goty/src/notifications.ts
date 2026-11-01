import { getUsersByIds, notify } from "@app/core";
import type { DbTx } from "@app/db";

const events = {
  joined: { title: "Tu participes à cette édition", tab: "" },
  preparation: { title: "La préparation des palmarès est ouverte", tab: "/palmares" },
  live: { title: "La soirée commence", tab: "/pronostics" },
  restart: { title: "L’édition est revenue en préparation", tab: "/palmares" },
  closed: { title: "Les archives sont disponibles", tab: "/archives" },
} as const;

/** Messages fixes : aucun nom libre, choix, score, jeu ou média dans la cloche du portail. */
export async function notifyEditionMembers(
  input: {
    editionId: string;
    year: number;
    actorId: string;
    event: keyof typeof events;
    recipients?: string[];
  },
  opts: { tx: DbTx },
) {
  const members = await opts.tx.gotyMember.findMany({
    where: { editionId: input.editionId },
    select: { userId: true },
  });
  const ids = members
    .map((member) => member.userId)
    .filter((id) => id !== input.actorId && (!input.recipients || input.recipients.includes(id)));
  // Les identités supprimées peuvent subsister dans GOTY (pas de FK entre domaines).
  const users = await getUsersByIds(ids);
  const event = events[input.event];
  for (const user of users)
    await notify(
      {
        userId: user.id,
        title: `GOTY ${input.year} · ${event.title}`,
        link: `/goty/${encodeURIComponent(input.editionId)}${event.tab}`,
      },
      opts,
    );
}
