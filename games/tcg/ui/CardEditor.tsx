"use client";

import { Button, Input, Label, Select, Textarea } from "@app/ui";
import { useActionState, useMemo, useState, useTransition } from "react";
import {
  CARD_LIMITS,
  CARD_RARITIES,
  CARD_RARITY_LABELS,
  type Card,
  type CardSet,
  DEFAULT_FRAME,
  type ImageFrame,
} from "../src/card-rules";
import {
  defaultParams,
  EFFECTS,
  type EffectDef,
  type EffectTrigger,
  type EffectParams,
  effectText,
  getEffect,
  TRIGGER_LABELS,
} from "../src/effects";
import { GameCard, GameCardDefs } from "./GameCard";
import { ImageFramer } from "./ImageFramer";
import { shrinkImage } from "./shrinkImage";

export type CardEditorState =
  { status: "idle" } | { status: "ok"; message: string } | { status: "error"; message: string };

/** Champs du formulaire (pré-remplissables à la création). */
export type CardFields = Fields;

type Fields = {
  name: string;
  rarity: Card["rarity"];
  type: string;
  family: string;
  cost: number;
  power: number;
  effectKey: string;
  effectParams: EffectParams;
  effectText: string;
  flavor: string;
};

type Props = {
  /** Carte à modifier, ou null pour en créer une (dans un des `sets`). */
  card: Card | null;
  sets: CardSet[];
  /** Familles déjà utilisées, proposées à la saisie. */
  families: string[];
  imageUrl: string | null;
  /** Nombre de cartes du set, pour le numéro affiché dans l'aperçu. */
  setSize?: number;
  /** Création : nombre de cartes de chaque set (par id), pour le numéro de l'aperçu. */
  setSizes?: Record<string, number>;
  /** Création : set proposé au départ (null : la réserve). */
  defaultSetId?: string | null;
  /** Création à partir d'une idée : son id et les champs pré-remplis depuis elle. */
  fromIdea?: {
    id: string;
    initial: Partial<Fields>;
    /** L'idée a déjà des cartes : il faut cocher « Créer quand même ». */
    hasCards: boolean;
  };
  /**
   * Server action passée par l'app : vérifie l'admin, puis crée ou modifie la carte. Champs
   * envoyés : `card`, le formulaire en JSON ; à la création, `setId` (vide : réserve), `ideaId` et
   * `confirmDuplicate`.
   */
  save: (state: CardEditorState, formData: FormData) => Promise<CardEditorState>;
  /**
   * Envoi de l'illustration (carte existante seulement) : `request` donne une URL d'envoi
   * présignée, le navigateur y envoie le fichier, puis `confirm` pose l'image sur la carte.
   */
  upload?: {
    request: (
      contentType: string,
      size: number,
    ) => Promise<{ key: string; url: string } | { error: string }>;
    confirm: (key: string) => Promise<{ error: string } | null>;
  };
};

const EFFECT_GROUPS = (Object.keys(TRIGGER_LABELS) as EffectTrigger[]).map((trigger) => ({
  trigger,
  effects: (EFFECTS as readonly EffectDef[]).filter((e) => e.trigger === trigger),
}));

function initialFields(card: Card | null, initial?: Partial<Fields>): Fields {
  return {
    ...defaults(card),
    ...(card ? {} : initial),
  };
}

function defaults(card: Card | null): Fields {
  return {
    name: card?.name ?? "",
    rarity: card?.rarity ?? "common",
    type: card?.type ?? "Créature",
    family: card?.family ?? "",
    cost: card?.cost ?? 1,
    power: card?.power ?? 2,
    effectKey: card?.effectKey ?? "",
    effectParams: card?.effectParams ?? {},
    effectText: card?.effectText ?? "",
    flavor: card?.flavor ?? "",
  };
}

/**
 * Formulaire d'une carte, avec l'aperçu du design retenu à côté, mis à jour pendant la saisie. Le
 * texte de l'effet suit l'effet choisi tant qu'on ne l'a pas réécrit à la main.
 */
export function CardEditor({
  card,
  sets,
  families,
  imageUrl,
  setSize,
  setSizes,
  defaultSetId,
  fromIdea,
  save,
  upload,
}: Props) {
  const [state, dispatch, pending] = useActionState(save, { status: "idle" });
  const [, startTransition] = useTransition();
  const [fields, setFields] = useState(() => initialFields(card, fromIdea?.initial));
  const [setId, setSetId] = useState(card?.setId ?? defaultSetId ?? "");
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  // Texte réécrit à la main : il ne suit plus l'effet.
  const [customText, setCustomText] = useState(
    () => !!card && card.effectText !== effectText(card.effectKey, card.effectParams),
  );
  const [layout, setLayout] = useState<"normal" | "fullart">("normal");
  const [image, setImage] = useState(imageUrl);
  const [frame, setFrame] = useState<ImageFrame>(card?.imageFrame ?? DEFAULT_FRAME);
  const [uploadState, setUploadState] = useState<string | null>(null);

  const variant = !!card?.baseCardId;
  const effect = fields.effectKey ? getEffect(fields.effectKey) : null;
  const proposed = effectText(fields.effectKey || null, effect ? fields.effectParams : null);
  const shownText = customText ? fields.effectText : proposed;

  const preview = useMemo(
    () => ({
      ...fields,
      family: fields.family.trim() || null,
      flavor: fields.flavor.trim() || null,
      effectText: shownText,
      number: card ? card.number : setId ? (setSizes?.[setId] ?? 0) + 1 : null,
      setCode: card ? card.setCode : sets.find((s) => s.id === setId)?.code,
      imageFrame: frame,
    }),
    [fields, shownText, card, sets, setId, setSizes, frame],
  );

  function set<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  function pickEffect(key: string) {
    const next = key ? getEffect(key) : null;
    setFields((f) => ({ ...f, effectKey: key, effectParams: next ? defaultParams(next) : {} }));
  }

  function submit() {
    const data = new FormData();
    data.set(
      "card",
      JSON.stringify({ ...fields, effectText: shownText, imageFrame: image ? frame : null }),
    );
    if (!card) {
      data.set("setId", setId);
      if (fromIdea) data.set("ideaId", fromIdea.id);
      if (confirmDuplicate) data.set("confirmDuplicate", "on");
    }
    startTransition(() => dispatch(data));
  }

  async function sendImage(original: File) {
    if (!upload || !card) return;
    setUploadState("Envoi…");
    const file = await shrinkImage(original);
    const target = await upload.request(file.type, file.size);
    if ("error" in target) return setUploadState(target.error);
    const put = await fetch(target.url, {
      method: "PUT",
      body: file,
      headers: { "content-type": file.type },
    }).catch(() => null);
    if (!put?.ok) return setUploadState("L'envoi de l'image a échoué.");
    const failed = await upload.confirm(target.key);
    if (failed) return setUploadState(failed.error);
    setImage(URL.createObjectURL(file));
    setFrame(DEFAULT_FRAME);
    setUploadState("Illustration enregistrée.");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {variant && (
          <p className="text-muted text-sm">
            Variante full art : le mana, la puissance, le type et l&apos;effet viennent de sa carte
            de base et se modifient sur elle.
          </p>
        )}
        {!card && (
          <Label>
            Set
            <Select value={setId} onChange={(e) => setSetId(e.target.value)}>
              <option value="">Réserve (hors set)</option>
              {sets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} · {s.name}
                </option>
              ))}
            </Select>
          </Label>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Label>
            Nom
            <Input
              value={fields.name}
              maxLength={CARD_LIMITS.name}
              onChange={(e) => set("name", e.target.value)}
              required
            />
          </Label>
          <Label>
            Rareté
            <Select
              value={fields.rarity}
              onChange={(e) => set("rarity", e.target.value as Fields["rarity"])}
            >
              {CARD_RARITIES.map((r) => (
                <option key={r} value={r}>
                  {CARD_RARITY_LABELS[r]}
                </option>
              ))}
            </Select>
          </Label>
          <Label hint="Créature, Objet, Instrument, Lieu…">
            Type
            <Input
              value={fields.type}
              maxLength={CARD_LIMITS.type}
              onChange={(e) => set("type", e.target.value)}
              disabled={variant}
              required
            />
          </Label>
          <Label hint="Après le tiret (« Grenouilles ») ; ciblée par certains effets.">
            Famille
            <Input
              value={fields.family}
              maxLength={CARD_LIMITS.family}
              list="tcg-families"
              onChange={(e) => set("family", e.target.value)}
              disabled={variant}
            />
          </Label>
          <Label>
            Mana
            <Input
              type="number"
              min={CARD_LIMITS.cost.min}
              max={CARD_LIMITS.cost.max}
              value={fields.cost}
              onChange={(e) => set("cost", Number(e.target.value))}
              disabled={variant}
            />
          </Label>
          <Label>
            Puissance
            <Input
              type="number"
              min={CARD_LIMITS.power.min}
              max={CARD_LIMITS.power.max}
              value={fields.power}
              onChange={(e) => set("power", Number(e.target.value))}
              disabled={variant}
            />
          </Label>
        </div>
        <datalist id="tcg-families">
          {families.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>

        <Label hint={effect?.snap ? `Repris de ${effect.snap} (Marvel Snap).` : undefined}>
          Effet
          <Select
            value={fields.effectKey}
            onChange={(e) => pickEffect(e.target.value)}
            disabled={variant}
          >
            <option value="">Aucun effet</option>
            {EFFECT_GROUPS.map((g) => (
              <optgroup key={g.trigger} label={TRIGGER_LABELS[g.trigger]}>
                {g.effects.map((e) => (
                  <option key={e.key} value={e.key}>
                    {e.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Label>
        {effect && effect.params.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {effect.params.map((p) => (
              <Label key={p.name}>
                {p.label}
                {p.kind === "int" ? (
                  <Input
                    type="number"
                    min={p.min}
                    max={p.max}
                    value={Number(fields.effectParams[p.name] ?? p.default)}
                    onChange={(e) =>
                      set("effectParams", {
                        ...fields.effectParams,
                        [p.name]: Number(e.target.value),
                      })
                    }
                    disabled={variant}
                  />
                ) : (
                  <Input
                    value={String(fields.effectParams[p.name] ?? "")}
                    list={p.kind === "family" ? "tcg-families" : undefined}
                    onChange={(e) =>
                      set("effectParams", { ...fields.effectParams, [p.name]: e.target.value })
                    }
                    disabled={variant}
                    required
                  />
                )}
              </Label>
            ))}
          </div>
        )}
        <Label
          hint={
            customText
              ? "Texte réécrit à la main : il ne suit plus l'effet."
              : "Proposé à partir de l'effet ; tu peux le réécrire."
          }
        >
          Texte de l&apos;effet
          <Textarea
            value={shownText}
            maxLength={CARD_LIMITS.effectText}
            onChange={(e) => {
              setCustomText(true);
              set("effectText", e.target.value);
            }}
            disabled={variant}
          />
        </Label>
        {customText && !variant && (
          <button
            type="button"
            className="text-accent self-start text-sm underline-offset-4 hover:underline"
            onClick={() => setCustomText(false)}
          >
            Reprendre le texte proposé
          </button>
        )}
        <Label hint="En italique sous l'effet.">
          Description
          <Textarea
            value={fields.flavor}
            maxLength={CARD_LIMITS.flavor}
            onChange={(e) => set("flavor", e.target.value)}
          />
        </Label>

        {fromIdea?.hasCards && (
          <label className="text-text flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmDuplicate}
              onChange={(e) => setConfirmDuplicate(e.target.checked)}
            />
            Créer quand même une autre carte pour cette idée
          </label>
        )}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {card ? "Enregistrer" : "Créer la carte"}
          </Button>
          {state.status !== "idle" && (
            <p
              role="status"
              className={state.status === "error" ? "text-danger text-sm" : "text-muted text-sm"}
            >
              {state.message}
            </p>
          )}
        </div>
      </form>

      <div className="flex flex-col items-center gap-3">
        <GameCardDefs />
        <GameCard card={preview} imageUrl={image} layout={layout} setSize={setSize} />
        <div className="flex gap-2 text-sm">
          {(["normal", "fullart"] as const).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={layout === l}
              onClick={() => setLayout(l)}
              className={
                layout === l
                  ? "border-accent text-text rounded-full border px-3 py-1"
                  : "border-border text-muted rounded-full border px-3 py-1"
              }
            >
              {l === "normal" ? "Normale" : "Full art"}
            </button>
          ))}
        </div>
        {image && (
          <div className="flex flex-col items-center gap-1">
            <p className="text-muted text-sm">
              Cadrage : glisse l&apos;image, zoome, puis enregistre la carte.
            </p>
            <ImageFramer
              imageUrl={image}
              frame={frame}
              onChange={setFrame}
              // Proportions de la fenêtre d'illustration : carte normale (264 × 172) ou full art.
              width={layout === "normal" ? 264 : 200}
              height={layout === "normal" ? 172 : 280}
            />
          </div>
        )}
        {upload && card && (
          <Label
            className="w-full max-w-[300px]"
            hint={uploadState ?? "JPEG, PNG ou WebP, 5 Mo maximum."}
          >
            Illustration
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="py-1.5"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void sendImage(file);
              }}
            />
          </Label>
        )}
      </div>
    </div>
  );
}
