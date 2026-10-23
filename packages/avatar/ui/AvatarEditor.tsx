"use client";

import {
  ANIMATIONS,
  catalog,
  CATEGORIES,
  DIRECTIONS,
  palettes,
  type Animation,
  type CatalogItem,
  type Category,
  type ColorId,
  type Direction,
  type Material,
  type Morph,
} from "@app/avatar-assets";
import { Button, Card, cx } from "@app/ui";
import { CircleCheck, Dices, Save, Undo2 } from "lucide-react";
import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { composeSheet, sheetLayout } from "../src/compose";
import type { AvatarConfig } from "../src/config";
import { canonicalJson } from "../src/hash";
import { randomConfig } from "../src/random";
import {
  availableMorphs,
  colorChoices,
  excludedCategories,
  eyeChoices,
  fitConfig,
  itemIndex,
  optionsFor,
  ownColorSlots,
  PREFERRED_HEADS,
  REQUIRED_CATEGORIES,
  skinChoices,
  withoutCategory,
} from "../src/rules";
import { ANIMATION_LABELS, DIRECTION_LABELS } from "./animation";
import { AvatarSprite } from "./AvatarSprite";
import { browserSpriteLoader, toBitmap } from "./browser";
import { CATEGORY_LABELS, HEAD_LABELS, MORPH_LABELS } from "./labels";

export type AvatarSaveState = { status: "ok" } | { status: "error"; message: string };

const layout = sheetLayout(catalog);

/** Teinte représentative d'une couleur (milieu clair de son dégradé). */
function swatch(material: Material, color: ColorId): string {
  const ramp = palettes[material][color] ?? [];
  return ramp[Math.floor(ramp.length * 0.6)] ?? "#000";
}

function colorName(color: ColorId): string {
  return color.slice(color.indexOf(".") + 1).replaceAll("_", " ");
}

function keptColors(
  item: CatalogItem,
  colors: Record<string, ColorId> | undefined,
): Record<string, ColorId> | undefined {
  const kept = Object.entries(colors ?? {}).filter(([id, color]) => {
    const slot = ownColorSlots(item).find((s) => s.id === id);
    return slot && colorChoices(palettes, slot.material, slot.base).includes(color);
  });
  return kept.length > 0 ? Object.fromEntries(kept) : undefined;
}

function Swatches({
  material,
  colors,
  value,
  onChange,
  label,
}: {
  material: Material;
  colors: ColorId[];
  value: ColorId | undefined;
  onChange: (color: ColorId) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          title={colorName(color)}
          aria-label={colorName(color)}
          onClick={() => onChange(color)}
          style={{ background: swatch(material, color) }}
          className={cx(
            "size-7 rounded-md border border-black/40 transition-transform hover:scale-110",
            value === color && "ring-accent ring-offset-bg ring-2 ring-offset-2",
          )}
        />
      ))}
    </div>
  );
}

type Props = {
  initialConfig: AvatarConfig;
  /** Server action : validation, composition de la planche finale, enregistrement. */
  save: (config: AvatarConfig) => Promise<AvatarSaveState>;
};

/** Éditeur d'avatar : aperçu composé dans le navigateur, enregistrement par le serveur. */
export function AvatarEditor({ initialConfig, save }: Props) {
  const [saved, setSaved] = useState(initialConfig);
  const [config, setConfig] = useState(initialConfig);
  const [animation, setAnimation] = useState<Animation>("walk");
  const [direction, setDirection] = useState<Direction>("down");
  const [category, setCategory] = useState<Category>("body");
  const [preview, setPreview] = useState<ImageBitmap | null>(null);
  const [state, setState] = useState<AvatarSaveState | null>(null);
  const [saving, startSaving] = useTransition();

  const dirty = canonicalJson(config) !== canonicalJson(saved);
  const morphs = useMemo(() => availableMorphs(catalog), []);
  const excluded = excludedCategories(config);
  const options = optionsFor(catalog, config, category);
  const choice = config.items[category];
  const selected: CatalogItem | undefined = choice ? itemIndex(catalog).get(choice.id) : undefined;

  // Aperçu recomposé à chaque changement ; seule la dernière composition s'affiche.
  useEffect(() => {
    let cancelled = false;
    composeSheet(config, catalog, palettes, browserSpriteLoader)
      .then(toBitmap)
      .then((bitmap) => {
        if (cancelled) bitmap.close();
        else setPreview(bitmap);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [config]);

  const update = (next: AvatarConfig) => {
    setConfig(fitConfig(next, catalog));
    setState(null);
  };
  const setItem = (cat: Category, item: CatalogItem | null) => {
    let items = { ...config.items };
    // Les couleurs de l'élément précédent sont gardées quand elles existent pour le nouveau.
    if (item) items[cat] = { id: item.id, colors: keptColors(item, config.items[cat]?.colors) };
    else items = withoutCategory(items, cat);
    update({ ...config, items });
  };
  // Nouvelle silhouette : la tête assortie (modifiable ensuite).
  const setMorph = (morph: Morph) => {
    const head = PREFERRED_HEADS[morph];
    update({
      ...config,
      morph,
      items: head ? { ...config.items, head: { id: head } } : config.items,
    });
  };
  const setItemColor = (slot: string, color: ColorId) => {
    if (!choice) return;
    update({
      ...config,
      items: {
        ...config.items,
        [category]: { ...choice, colors: { ...choice.colors, [slot]: color } },
      },
    });
  };
  const itemColor = (slot: { id: string; material: Material; base: ColorId }) => {
    const color = choice?.colors?.[slot.id];
    return color && colorChoices(palettes, slot.material, slot.base).includes(color)
      ? color
      : slot.base;
  };

  const onSave = () =>
    startSaving(async () => {
      const result = await save(config);
      setState(result);
      if (result.status === "ok") setSaved(config);
    });

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      <Card title="Aperçu" className="flex flex-col gap-4 self-start lg:sticky lg:top-20">
        <div className="bg-surface-hover/60 grid place-items-center rounded-md border border-(--frame) py-4">
          <AvatarSprite
            sheet={preview}
            layout={layout}
            animation={animation}
            direction={direction}
            scale={4}
          />
        </div>
        <div role="radiogroup" aria-label="Animation" className="flex flex-wrap gap-1.5">
          {ANIMATIONS.map((a) => (
            <Button
              key={a}
              size="sm"
              variant={a === animation ? "primary" : "secondary"}
              role="radio"
              aria-checked={a === animation}
              onClick={() => setAnimation(a)}
            >
              {ANIMATION_LABELS[a]}
            </Button>
          ))}
        </div>
        <div role="radiogroup" aria-label="Direction" className="flex flex-wrap gap-1.5">
          {DIRECTIONS.map((d) => (
            <Button
              key={d}
              size="sm"
              variant={d === direction ? "primary" : "secondary"}
              role="radio"
              aria-checked={d === direction}
              onClick={() => setDirection(d)}
            >
              {DIRECTION_LABELS[d]}
            </Button>
          ))}
        </div>
        <div className="border-border flex flex-wrap gap-2 border-t pt-4">
          <Button variant="secondary" onClick={() => update(randomConfig(catalog, palettes))}>
            <Dices size={16} aria-hidden /> Aléatoire
          </Button>
          <Button variant="secondary" disabled={!dirty} onClick={() => update(saved)}>
            <Undo2 size={16} aria-hidden /> Annuler les changements
          </Button>
          <Button disabled={!dirty || saving} onClick={onSave}>
            <Save size={16} aria-hidden /> {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
        <p role="status" className="min-h-5 text-sm">
          {state?.status === "ok" && !dirty && (
            <span className="text-success inline-flex items-center gap-1.5">
              <CircleCheck size={16} aria-hidden /> Avatar enregistré.
            </span>
          )}
          {state?.status === "error" && <span className="text-danger">{state.message}</span>}
        </p>
      </Card>

      <div className="flex min-w-0 flex-col gap-4">
        <Card title="Couleurs">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-muted text-sm">Peau</span>
              <Swatches
                material="body"
                label="Couleur de peau"
                colors={skinChoices(palettes)}
                value={config.skin}
                onChange={(skin) => update({ ...config, skin })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-muted text-sm">Yeux</span>
              <Swatches
                material="eye"
                label="Couleur des yeux"
                colors={eyeChoices(palettes)}
                value={config.eyes}
                onChange={(eyes) => update({ ...config, eyes })}
              />
            </div>
          </div>
        </Card>

        <Card title="Tenue">
          <div
            role="tablist"
            aria-label="Catégories"
            className="-mx-1 mb-4 flex flex-wrap gap-1.5 px-1"
          >
            {CATEGORIES.map((cat) => {
              // La tête se choisit dans l'onglet Corps, avec la morphologie.
              if (cat === "head") return null;
              const count = optionsFor(catalog, config, cat).length;
              if (count === 0) return null;
              return (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={cat === category}
                  onClick={() => setCategory(cat)}
                  className={cx(
                    "rounded-md border px-2.5 py-1 text-xs transition-colors",
                    cat === category
                      ? "border-accent bg-accent/15 text-accent font-semibold"
                      : "text-muted hover:text-text border-(--frame)",
                    config.items[cat] && cat !== category && "text-text",
                  )}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              );
            })}
          </div>

          <div role="tabpanel" className="flex flex-col gap-4">
            {category === "body" ? (
              <>
                <div className="flex flex-col gap-1.5">
                  <span className="text-muted text-sm">Morphologie</span>
                  <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {morphs.map((m) => (
                      <li key={m}>
                        <OptionButton active={config.morph === m} onClick={() => setMorph(m)}>
                          {MORPH_LABELS[m]}
                        </OptionButton>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-muted text-sm">Tête</span>
                  <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {optionsFor(catalog, config, "head").map((item) => (
                      <li key={item.id}>
                        <OptionButton
                          active={config.items.head?.id === item.id}
                          onClick={() => setItem("head", item)}
                        >
                          {HEAD_LABELS[item.id] ?? item.name}
                        </OptionButton>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : excluded.has(category) ? (
              <p className="text-muted text-sm">
                Retiré par la robe : enlève-la pour choisir un bas.
              </p>
            ) : (
              <>
                {/* Couleurs d'abord : la liste des éléments peut être longue (90 coiffures). */}
                {selected &&
                  ownColorSlots(selected).map((slot, i, slots) => (
                    <div key={slot.id} className="flex flex-col gap-1.5">
                      <span className="text-muted text-sm">
                        Couleur{slots.length > 1 ? ` ${i + 1}` : ""} de « {selected.name} »
                      </span>
                      <Swatches
                        material={slot.material}
                        label={`Couleur ${i + 1} de ${selected.name}`}
                        colors={colorChoices(palettes, slot.material, slot.base)}
                        value={itemColor(slot)}
                        onChange={(color) => setItemColor(slot.id, color)}
                      />
                    </div>
                  ))}
                <ul className="border-border grid max-h-[26rem] grid-cols-2 gap-1.5 overflow-y-auto border-t pt-3 pr-1 sm:grid-cols-3 xl:grid-cols-4">
                  {!REQUIRED_CATEGORIES.includes(category) && (
                    <li>
                      <OptionButton active={!choice} onClick={() => setItem(category, null)}>
                        Aucun
                      </OptionButton>
                    </li>
                  )}
                  {options.map((item) => (
                    <li key={item.id}>
                      <OptionButton
                        active={choice?.id === item.id}
                        onClick={() => setItem(category, item)}
                      >
                        {item.name}
                      </OptionButton>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function OptionButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        "w-full truncate rounded-md border px-2.5 py-2 text-left text-sm transition-colors",
        active
          ? "border-accent bg-accent/15 text-text font-semibold"
          : "bg-surface text-muted hover:text-text hover:border-accent/50 border-(--frame)",
      )}
    >
      {children}
    </button>
  );
}
