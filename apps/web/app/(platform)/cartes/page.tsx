import { getUsersByIds, isAdmin } from "@app/core";
import { getShowcaseIdea, type ShowcaseIdea } from "@app/ideas";
import {
  commentTags,
  DESIGN_TAB,
  designNumber,
  DESIGNS,
  type DesignId,
  type DesignVote,
  EFFECTS_TAB,
  listDesignVotes,
  REFERENCES,
} from "@app/tcg";
import { type CardData, DesignPreview, DesignRating } from "@app/tcg/ui";
import { buttonClasses, Card, cx } from "@app/ui";
import { Star } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { getCurrentMember } from "@/lib/session";
import { rateDesignAction } from "./actions";
import { designFonts } from "./fonts";

export const metadata: Metadata = { title: "Vote pour le design des cartes" };

type Tab = "design" | "effets" | "variantes" | "archives";
/**
 * Onglets de la page. `hidden` : masqué pour l'instant mais gardé tel quel (propositions, votes et
 * code intacts) ; repasser à false pour le remettre.
 */
const TABS: { id: Tab; label: string; hidden?: boolean }[] = [
  { id: "design", label: "Design" },
  { id: "effets", label: "Effets de rareté", hidden: true },
  { id: "variantes", label: "Variantes", hidden: true },
  { id: "archives", label: "Archives" },
];
const SHOWN_TABS = TABS.filter((t) => !t.hidden);

/** Coût de 1 à 6, stable pour une idée donnée. La rareté n'influence jamais les stats. */
function costOf(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (h % 6) + 1;
}

/** La carte exemple (l'idée exemple, seule visible des membres), ou une carte fictive en local. */
function sampleCard(idea: ShowcaseIdea | null, author: string): CardData {
  if (!idea) {
    return {
      title: "Carte exemple",
      flavor: "Une idée de la boîte.",
      effect: "À la révélation : −2 puissance à la carte adverse la plus forte ici.",
      tag: "Exemple",
      rarity: "common",
      cost: 2,
      power: 4,
      imageUrl: null,
      author: "Potopia",
      serial: "01/01",
    };
  }
  const cost = costOf(idea.id);
  const description = idea.description.trim();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    title: idea.title,
    flavor: description && description !== "--" ? description : null,
    effect: idea.effectIdea?.trim() || "Effet à définir.",
    tag: idea.concernedPeople?.trim() || "Idée",
    rarity: idea.suggestedRarity ?? "common",
    cost,
    // Budget de puissance : 2 × coût + 1, moins 1 quand la carte a un effet.
    power: 2 * cost + (idea.effectIdea ? 0 : 1),
    imageUrl: idea.imageKey ? "/api/cartes/exemple" : null,
    author,
    serial: `${pad(idea.rank)}/${pad(idea.total)}`,
  };
}

/** Moyenne des notes (0 étoile = commentaire sans note, ignoré), ou null sans note. */
function average(votes: DesignVote[]): number | null {
  const rated = votes.filter((v) => v.stars > 0).map((v) => v.stars);
  return rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : null;
}

export default async function CardsVotePage({
  searchParams,
}: {
  searchParams: Promise<{ onglet?: string; masquer?: string }>;
}) {
  const member = await getCurrentMember();
  const params = await searchParams;
  const tab = SHOWN_TABS.find((t) => t.id === params.onglet)?.id ?? "design";
  const hideVoted = params.masquer === "1";

  const [idea, votes] = await Promise.all([getShowcaseIdea(), listDesignVotes()]);
  const users = await getUsersByIds([
    ...new Set([...(idea ? [idea.authorId] : []), ...votes.map((v) => v.userId)]),
  ]);
  const byId = new Map(users.map((u) => [u.id, u]));
  const name = (id: string) => byId.get(id)?.name ?? "Membre inconnu";
  const cards = [sampleCard(idea, idea ? name(idea.authorId) : "Potopia")];

  // « à supprimer » et « variant » ne comptent que dans les commentaires des admins.
  const tagsOf = (id: DesignId) => {
    const fromAdmins = votes.filter(
      (v) => v.designId === id && isAdmin(byId.get(v.userId)?.discordId ?? null),
    );
    return {
      remove: fromAdmins.some((v) => commentTags(v.comment).remove),
      variant: fromAdmins.some((v) => commentTags(v.comment).variant),
    };
  };
  const row = (id: DesignId) => {
    const forDesign = votes.filter((v) => v.designId === id);
    return {
      design: DESIGNS.find((d) => d.id === id) ?? DESIGNS[0],
      number: designNumber(id),
      avg: average(forDesign),
      mine: forDesign.find((v) => v.userId === member.id),
      others: forDesign.filter((v) => v.userId !== member.id),
    };
  };

  const current = new Set<DesignId>([...DESIGN_TAB, ...EFFECTS_TAB, ...REFERENCES]);
  const kept = (ids: readonly DesignId[]) => ids.filter((id) => !tagsOf(id).remove);
  const old = DESIGNS.map((d) => d.id).filter((id) => !current.has(id));
  const lists: Record<Tab, DesignId[]> = {
    design: kept(DESIGN_TAB),
    effets: kept(EFFECTS_TAB),
    variantes: old.filter((id) => tagsOf(id).variant && !tagsOf(id).remove),
    archives: old.filter((id) => !tagsOf(id).variant && !tagsOf(id).remove),
  };
  const trash = DESIGNS.map((d) => d.id).filter((id) => tagsOf(id).remove);
  const toVote = (t: Tab) => lists[t].filter((id) => !row(id).mine).length;
  const visible = (ids: DesignId[]) => ids.map(row).filter((r) => !hideVoted || !r.mine);

  const href = (t: Tab, hide = hideVoted) =>
    `/cartes?onglet=${t}${hide ? "&masquer=1" : ""}` as const;

  return (
    <div className={`${designFonts} flex flex-col gap-4`}>
      <Breadcrumb />
      <Card
        title="Vote pour le design des cartes"
        action={
          isAdmin(member.discordId) ? (
            <a
              href="/api/admin/cards/votes"
              download
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              Exporter les notes (JSON)
            </a>
          ) : undefined
        }
      >
        <div className="text-muted flex flex-col gap-2 text-sm">
          <p>
            On prépare le futur jeu de cartes du serveur : note les propositions de 1 à 5 étoiles
            (un clic enregistre) et laisse un commentaire si tu veux. Toutes les propositions
            utilisent la même carte exemple.
          </p>
          <p>
            On vote d&apos;abord le <strong className="text-text">design</strong> : la mise en page
            de la carte, normale ou full art. Les effets de rareté viendront plus tard : chaque
            carte a une rareté qui ne change jamais, et la rareté ne touche qu&apos;au look, jamais
            à la puissance.
          </p>
        </div>
      </Card>

      <nav className="flex flex-wrap items-center gap-2" aria-label="Onglets">
        {SHOWN_TABS.map((t) => {
          const n = toVote(t.id);
          return (
            <Link
              key={t.id}
              href={href(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={cx(
                "rounded-full border px-3 py-1.5 text-sm transition",
                tab === t.id
                  ? "border-accent bg-accent/15 text-text font-semibold"
                  : "border-border text-muted hover:text-text",
              )}
            >
              {t.label}
              {n > 0 && t.id !== "archives" && (
                <span className="bg-accent text-on-accent ml-1.5 rounded-full px-1.5 text-xs">
                  {n}
                </span>
              )}
            </Link>
          );
        })}
        <Link
          href={href(tab, !hideVoted)}
          className="text-muted hover:text-text ml-auto text-sm underline-offset-4 hover:underline"
        >
          {hideVoted ? "Afficher aussi ceux que j'ai notés" : "Masquer ceux que j'ai notés"}
        </Link>
      </nav>

      {tab === "design" && (
        <p className="text-muted text-sm">
          Mélange des deux designs préférés, le 39 (Arcanes V2) et le 44 (Raretés V3), montré sans
          effet de rareté : une carte normale et une carte full art pour chaque proposition. Tout
          est visible d&apos;emblée, rien n&apos;apparaît au survol.
        </p>
      )}
      {tab === "effets" && (
        <p className="text-muted text-sm">
          Ce que chaque rareté ajoute, de commune à SSR, posé sur le même design (« Mix · Sculpté et
          verre fumé ») en carte normale puis en full art.
        </p>
      )}
      {tab === "variantes" && (
        <p className="text-muted text-sm">
          Les anciennes propositions gardées pour des variantes de cartes (commentées « variant »
          par un admin), à ressortir plus tard.
        </p>
      )}

      {tab === "archives" ? (
        <Archives rows={visible(lists.archives)} trash={visible(trash)} cards={cards} name={name} />
      ) : (
        <>
          {visible(lists[tab]).map((r) => (
            <DesignCard
              key={r.design.id}
              row={r}
              cards={cards}
              name={name}
              wide={tab === "effets"}
            />
          ))}
          {tab === "design" && (
            <Card title="Points de départ : 39 et 44">
              <div className="flex flex-col gap-2">
                {visible(kept(REFERENCES)).map((r) => (
                  <Folded key={r.design.id} row={r} cards={cards} name={name} />
                ))}
              </div>
            </Card>
          )}
          {visible(lists[tab]).length === 0 && (
            <Card>
              <p className="text-muted text-sm">
                {hideVoted
                  ? "Tu as tout noté ici, merci !"
                  : "Rien dans cet onglet pour l'instant."}
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

/** Onglet Archives : anciennes propositions repliées, puis la corbeille. */
function Archives({
  rows,
  trash,
  cards,
  name,
}: {
  rows: RowProps["row"][];
  trash: RowProps["row"][];
  cards: CardData[];
  name: (id: string) => string;
}) {
  return (
    <>
      <Card title="Mis de côté">
        <p className="text-muted mb-3 text-sm">
          Les anciennes propositions. Pour en ressortir une, commente-la « variant » ; pour la
          jeter, « à supprimer ».
        </p>
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <Folded key={r.design.id} row={r} cards={cards} name={name} />
          ))}
        </div>
      </Card>
      {trash.length > 0 && (
        <Card title="Corbeille (« à supprimer »)">
          <div className="flex flex-col gap-2">
            {trash.map((r) => (
              <Folded key={r.design.id} row={r} cards={cards} name={name} />
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

function Average({ avg }: { avg: number | null }) {
  if (avg === null) return null;
  return (
    <span className="text-muted inline-flex items-center gap-1">
      moyenne {Math.round(avg * 10) / 10}
      <Star size={12} className="fill-accent text-accent" aria-hidden />
    </span>
  );
}

type RowProps = {
  row: {
    design: (typeof DESIGNS)[number];
    number: number;
    avg: number | null;
    mine: DesignVote | undefined;
    others: DesignVote[];
  };
  cards: CardData[];
  name: (id: string) => string;
};

/** Une proposition : aperçu, ma note et les avis des autres. */
function DesignCard({ row, cards, name, wide = false }: RowProps & { wide?: boolean }) {
  const { design, number, avg, mine } = row;
  return (
    <Card
      title={`${number} · ${design.title}`}
      action={
        <span className="flex items-center gap-2 text-xs">
          {!mine && (
            <span className="bg-accent/15 text-accent rounded-full px-2 py-0.5 font-semibold">
              À noter
            </span>
          )}
          <Average avg={avg} />
        </span>
      }
    >
      <p className="text-muted mb-3 text-sm">{design.summary}</p>
      {/* Cartes réduites pour voir une planche entière d'un coup d'œil. */}
      <div style={{ zoom: wide ? 0.6 : 0.72 }}>
        <DesignPreview designId={design.id} cards={cards} />
      </div>
      <Opinions row={row} name={name} />
    </Card>
  );
}

/** Proposition repliée (références, archives, corbeille) : on la déplie pour la revoir et la noter. */
function Folded({ row, cards, name }: RowProps) {
  const { design, number, avg } = row;
  return (
    <details className="border-border rounded-md border px-3 py-2">
      <summary className="text-muted cursor-pointer text-sm">
        {number} · {design.title} {avg !== null && `(${Math.round(avg * 10) / 10} ★)`}
      </summary>
      <p className="text-muted mt-2 text-sm">{design.summary}</p>
      <div className="mt-3" style={{ zoom: 0.6 }}>
        <DesignPreview designId={design.id} cards={cards} />
      </div>
      <Opinions row={row} name={name} />
    </details>
  );
}

function Opinions({ row, name }: Omit<RowProps, "cards">) {
  const { design, mine, others } = row;
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <div className="flex flex-col gap-2">
        <p className="text-text text-sm font-medium">Ton avis</p>
        <DesignRating
          designId={design.id}
          initial={mine ? { stars: mine.stars, comment: mine.comment } : null}
          action={rateDesignAction}
        />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-text text-sm font-medium">Avis des autres</p>
        {others.length === 0 ? (
          <p className="text-muted text-sm">Pas encore d&apos;avis.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {others.map((v) => (
              <li key={v.userId} className="border-border rounded-md border p-2">
                <span className="text-text font-medium">{name(v.userId)}</span>{" "}
                <span className="text-accent inline-flex items-center gap-0.5 align-middle">
                  {v.stars > 0 ? (
                    <>
                      {v.stars}
                      <Star size={14} className="fill-accent" aria-label="étoiles" />
                    </>
                  ) : (
                    <span className="text-muted">sans note</span>
                  )}
                </span>
                {v.comment && <p className="text-muted mt-1">{v.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
