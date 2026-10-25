import { BRAND } from "@app/config/brand";
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
 * code intacts) ; repasser à false pour le remettre. Tant qu'un onglet est masqué, ses designs
 * restent visibles et notables dans les Archives, dans une carte à part.
 */
const TABS: { id: Tab; label: string; hidden?: boolean }[] = [
  { id: "design", label: "Design" },
  { id: "effets", label: "Effets de rareté", hidden: true },
  { id: "variantes", label: "Variantes", hidden: true },
  { id: "archives", label: "Archives" },
];
const SHOWN_TABS = TABS.filter((t) => !t.hidden);
const isHidden = (t: Tab) => TABS.some((x) => x.id === t && x.hidden);

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
      author: BRAND.name,
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

/** Un design compte comme « noté » avec au moins une étoile ou un commentaire (note retirée = non). */
function isRated(vote: DesignVote | undefined): boolean {
  return !!vote && (vote.stars > 0 || !!vote.comment);
}

export default async function CardsVotePage({
  searchParams,
}: {
  searchParams: Promise<{ onglet?: string; masquer?: string; voir?: string }>;
}) {
  const member = await getCurrentMember();
  const params = await searchParams;
  const tab = SHOWN_TABS.find((t) => t.id === params.onglet)?.id ?? "design";
  const hideVoted = params.masquer === "1";
  // Design archivé dont l'aperçu est ouvert (les autres n'affichent que titre et résumé).
  const seen = DESIGNS.find((d) => d.id === params.voir)?.id ?? null;

  const [idea, votes] = await Promise.all([getShowcaseIdea(), listDesignVotes()]);
  const users = await getUsersByIds([
    ...new Set([...(idea ? [idea.authorId] : []), ...votes.map((v) => v.userId)]),
  ]);
  const byId = new Map(users.map((u) => [u.id, u]));
  const name = (id: string) => byId.get(id)?.name ?? "Membre inconnu";
  const cards = [sampleCard(idea, idea ? name(idea.authorId) : BRAND.name)];

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
    const mine = forDesign.find((v) => v.userId === member.id);
    return {
      design: DESIGNS.find((d) => d.id === id) ?? DESIGNS[0],
      number: designNumber(id),
      avg: average(forDesign),
      mine,
      rated: isRated(mine),
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
  // Ce que chaque onglet donne à noter : l'onglet Design compte aussi ses deux références.
  const countable: Record<Tab, DesignId[]> = {
    ...lists,
    design: [...lists.design, ...kept(REFERENCES)],
  };
  const toVote = (t: Tab) => countable[t].filter((id) => !row(id).rated).length;
  const visible = (ids: DesignId[]) => ids.map(row).filter((r) => !hideVoted || !r.rated);

  const href = (t: Tab, hide = hideVoted) =>
    `/cartes?onglet=${t}${hide ? "&masquer=1" : ""}${t === "archives" && seen ? `&voir=${seen}` : ""}`;
  /** Lien qui ouvre l'aperçu d'un design archivé, en gardant les autres paramètres. */
  const seeHref = (id: DesignId) =>
    `/cartes?onglet=archives${hideVoted ? "&masquer=1" : ""}&voir=${id}#design-${id}`;

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
        <Archives
          variants={isHidden("variantes") ? visible(lists.variantes) : []}
          effects={isHidden("effets") ? visible(lists.effets) : []}
          rows={visible(lists.archives)}
          trash={visible(trash)}
          seen={seen}
          seeHref={seeHref}
          cards={cards}
          name={name}
        />
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

/**
 * Onglet Archives : les designs des onglets masqués (variantes, effets), les anciennes propositions
 * repliées, puis la corbeille. Seul le design « ouvert » (`?voir=`) rend sa planche : les autres
 * n'affichent que leur titre et leur résumé, avec un lien vers l'aperçu.
 */
function Archives({
  variants,
  effects,
  rows,
  trash,
  seen,
  seeHref,
  cards,
  name,
}: {
  variants: RowProps["row"][];
  effects: RowProps["row"][];
  rows: RowProps["row"][];
  trash: RowProps["row"][];
  seen: DesignId | null;
  seeHref: (id: DesignId) => string;
  cards: CardData[];
  name: (id: string) => string;
}) {
  const list = (items: RowProps["row"][]) => (
    <div className="flex flex-col gap-2">
      {items.map((r) => (
        <Folded
          key={r.design.id}
          row={r}
          cards={cards}
          name={name}
          lazy={{ open: seen === r.design.id, href: seeHref(r.design.id) }}
        />
      ))}
    </div>
  );
  return (
    <>
      {variants.length > 0 && (
        <Card title="Variantes (gardées pour plus tard)">
          <p className="text-muted mb-3 text-sm">
            Les anciennes propositions commentées « variant » par un admin : à ressortir plus tard
            comme variantes de cartes, toujours à noter.
          </p>
          {list(variants)}
        </Card>
      )}
      {effects.length > 0 && (
        <Card title="Effets de rareté (en pause)">
          <p className="text-muted mb-3 text-sm">
            Ce que chaque rareté ajoute, posé sur le design « Mix · Sculpté et verre fumé ». On y
            reviendra une fois le design choisi ; tu peux déjà les noter.
          </p>
          {list(effects)}
        </Card>
      )}
      <Card title="Mis de côté">
        <p className="text-muted mb-3 text-sm">
          Les anciennes propositions. Clique sur un titre pour voir sa planche et la noter. Un admin
          qui la commente « variant » la range dans les variantes gardées pour plus tard ; « à
          supprimer » la met à la corbeille.
        </p>
        {list(rows)}
      </Card>
      {trash.length > 0 && <Card title="Corbeille (« à supprimer »)">{list(trash)}</Card>}
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

function ToRate() {
  return (
    <span className="bg-accent/15 text-accent rounded-full px-2 py-0.5 text-xs font-semibold">
      À noter
    </span>
  );
}

type RowProps = {
  row: {
    design: (typeof DESIGNS)[number];
    number: number;
    avg: number | null;
    mine: DesignVote | undefined;
    /** Vrai avec au moins une étoile ou un commentaire. */
    rated: boolean;
    others: DesignVote[];
  };
  cards: CardData[];
  name: (id: string) => string;
};

/** Une proposition : aperçu, ma note et les avis des autres. */
function DesignCard({ row, cards, name, wide = false }: RowProps & { wide?: boolean }) {
  const { design, number, avg, rated } = row;
  return (
    <Card
      title={`${number} · ${design.title}`}
      action={
        <span className="flex items-center gap-2 text-xs">
          {!rated && <ToRate />}
          <Average avg={avg} />
        </span>
      }
    >
      <p className="text-muted mb-3 text-sm">{design.summary}</p>
      {/* Cartes réduites pour voir une planche entière d'un coup d'œil. */}
      <DesignPreview designId={design.id} cards={cards} zoom={wide ? 0.6 : 0.72} />
      <Opinions row={row} name={name} />
    </Card>
  );
}

/**
 * Proposition repliée (références, archives, corbeille) : on la déplie pour la revoir et la noter.
 * En mode `lazy` (archives), la planche n'est rendue que si `open` ; sinon le titre est un lien
 * (`href`) qui ouvre la page sur cette proposition.
 */
function Folded({ row, cards, name, lazy }: RowProps & { lazy?: { open: boolean; href: string } }) {
  const { design, number, avg, rated } = row;
  const title = (
    <>
      {number} · {design.title} {avg !== null && `(${Math.round(avg * 10) / 10} ★)`}
    </>
  );
  const id = `design-${design.id}`;
  if (lazy && !lazy.open) {
    return (
      <details id={id} className="border-border rounded-md border px-3 py-2">
        <summary className="text-muted cursor-pointer text-sm">
          <Link href={lazy.href} className="hover:text-text underline-offset-4 hover:underline">
            {title}
          </Link>
          {!rated && (
            <>
              {" "}
              <ToRate />
            </>
          )}
        </summary>
        <p className="text-muted mt-2 text-sm">{design.summary}</p>
        <Link
          href={lazy.href}
          className="text-accent mt-2 inline-block text-sm underline-offset-4 hover:underline"
        >
          Voir l&apos;aperçu
        </Link>
      </details>
    );
  }
  return (
    <details id={id} open={lazy?.open} className="border-border rounded-md border px-3 py-2">
      <summary className="text-muted cursor-pointer text-sm">
        {title}
        {!rated && (
          <>
            {" "}
            <ToRate />
          </>
        )}
      </summary>
      <p className="text-muted mt-2 text-sm">{design.summary}</p>
      <div className="mt-3">
        <DesignPreview designId={design.id} cards={cards} zoom={0.6} />
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
