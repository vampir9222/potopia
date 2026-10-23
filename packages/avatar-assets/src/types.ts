// Types du catalogue d'éléments d'avatar, généré par scripts/import-lpc.ts depuis les données LPC.

/** Morphologies proposées. LPC en a d'autres (teen, child, muscular, pregnant), non importées. */
export const MORPHS = ["male", "female"] as const;
export type Morph = (typeof MORPHS)[number];

/** Animations retenues, dans l'ordre des lignes de la planche composée. */
export const ANIMATIONS = ["idle", "walk", "sit", "jump", "emote"] as const;
export type Animation = (typeof ANIMATIONS)[number];

/** Une ligne par direction dans chaque planche LPC, dans cet ordre. */
export const DIRECTIONS = ["up", "left", "down", "right"] as const;
export type Direction = (typeof DIRECTIONS)[number];

/** Taille d'une frame LPC. */
export const FRAME_SIZE = 64;

export const CATEGORIES = [
  "body",
  "head",
  "eyes",
  "eyebrows",
  "nose",
  "ears",
  "hair",
  "beards",
  "facial",
  "torso",
  "dress",
  "legs",
  "feet",
  "hat",
  "cape",
  "backpack",
] as const;
export type Category = (typeof CATEGORIES)[number];

/** Matériaux de recoloration LPC (un jeu de palettes chacun). */
export type Material = "body" | "hair" | "cloth" | "eye" | "metal" | "wood";

/** Identifiant d'une couleur : `<version>.<nom>` (`ulpc.light`, `lpcr.ivory`). */
export type ColorId = string;

/**
 * Emplacement de couleur d'un élément. Les pixels du dessin utilisent les teintes de `base` ;
 * on les remplace par celles de la couleur choisie (palette swap).
 * - `skin` : partagé avec le corps (peau), choisi une fois pour tout l'avatar.
 * - `eyes` : couleur des yeux, choisie une fois pour tout l'avatar.
 */
export type ColorSlot = {
  id: string;
  material: Material;
  base: ColorId;
  shared?: "skin" | "eyes";
};

export type Layer = {
  zPos: number;
  /**
   * Dossier (relatif à `sprites/`) par morphologie, qui contient `<animation>.png`. Peut contenir
   * `${head}`, remplacé par `CatalogItem.headPaths[<id de la tête>]`.
   */
  dirs: Partial<Record<Morph, string>>;
};

export type CatalogItem = {
  id: string;
  category: Category;
  name: string;
  /** Morphologies pour lesquelles l'élément existe avec les 5 animations. */
  morphs: Morph[];
  /** Calques, chacun avec son zPos (bg/fg, layer_1/layer_2…). */
  layers: Layer[];
  /** Nombre de frames par animation (largeur de la planche / 64). */
  frames: Record<Animation, number>;
  colors: ColorSlot[];
  tags: string[];
  /** Tags que doivent porter les éléments choisis (la tête humaine pour un visage…). */
  requiredTags: string[];
  /** Pour un élément dont le chemin dépend de la tête : id de tête → segment `${head}`. */
  headPaths?: Record<string, string>;
  /** Têtes compatibles par morphologie, pour un élément qui dépend de la tête. */
  heads?: Partial<Record<Morph, string[]>>;
  /**
   * Animations absentes chez LPC, remplacées par une autre (`emote` → `idle`) ou non dessinées
   * (`null`). Seules certaines catégories y ont droit (capes).
   */
  fallbacks?: Partial<Record<Animation, Animation | null>>;
  /** "free" : disponible pour tous. Plus tard : élément à débloquer (UserAvatarItem). */
  unlock: "free" | { item: string };
};

export type Catalog = {
  /** Commit LPC importé : change à chaque import, invalide les planches composées. */
  source: { repo: string; ref: string };
  /** Frames par animation de la planche composée (identiques pour tous les éléments). */
  frames: Record<Animation, number>;
  items: CatalogItem[];
};

/** Palettes par matériau : couleur → dégradé de teintes `#rrggbb`. */
export type Palettes = Record<Material, Record<ColorId, string[]>>;

export type Credit = {
  itemId: string;
  name: string;
  category: Category;
  entries: {
    file: string;
    notes?: string;
    authors: string[];
    licenses: string[];
    urls: string[];
  }[];
};
