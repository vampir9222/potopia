import { BRAND } from "@app/config/brand";
import { Badge } from "@app/ui";
import { RARITY_LABELS, type Rarity } from "../src/validation";

type Props = {
  idea: {
    title: string;
    description: string;
    concernedPeople: string | null;
    suggestedRarity: Rarity | null;
    effectIdea: string | null;
    createdAt: Date;
  };
  authorName: string;
  /** Route admin qui redirige vers l'image (URL présignée courte), ou null sans image. */
  imageSrc: string | null;
};

const date = new Intl.DateTimeFormat(BRAND.locale, {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: BRAND.timeZone,
});

function Field({ label, children }: { label: string; children: string }) {
  return (
    <div>
      <h3 className="text-muted text-xs font-medium">{label}</h3>
      <p className="text-text text-sm whitespace-pre-wrap">{children}</p>
    </div>
  );
}

export function IdeaDetail({ idea, authorName, imageSrc }: Props) {
  return (
    <article className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-text text-lg font-semibold">{idea.title}</h2>
          <p className="text-muted text-xs">
            {authorName} · {date.format(idea.createdAt)}
          </p>
        </div>
        {idea.suggestedRarity && <Badge tone="accent">{RARITY_LABELS[idea.suggestedRarity]}</Badge>}
      </header>
      <Field label="Description">{idea.description}</Field>
      {idea.concernedPeople && <Field label="Personnes concernées">{idea.concernedPeople}</Field>}
      {idea.effectIdea && <Field label="Idée d'effet">{idea.effectIdea}</Field>}
      {imageSrc && (
        <a href={imageSrc} target="_blank" rel="noreferrer" className="self-start">
          <img
            src={imageSrc}
            alt={`Image jointe à « ${idea.title} »`}
            className="border-border rounded-theme max-h-96 max-w-full border object-contain"
          />
        </a>
      )}
    </article>
  );
}
