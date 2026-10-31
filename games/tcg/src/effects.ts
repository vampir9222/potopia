import { z } from "zod";

/*
 * Catalogue des effets de carte. La base ne stocke que la clé d'un effet et ses réglages
 * (`TcgCard.effectKey`, `effectParams`) : l'admin choisit l'effet dans cette liste et règle ses
 * nombres, sans déploiement. Un effet vraiment nouveau s'ajoute ici, puis se donne à n'importe
 * quelle carte. Le moteur de partie (à venir) lira la même liste.
 */

/** Moment où l'effet agit. */
export type EffectTrigger = "reveal" | "ongoing" | "end_of_turn" | "destroyed";

export const TRIGGER_LABELS: Record<EffectTrigger, string> = {
  reveal: "À la révélation",
  ongoing: "Permanent",
  end_of_turn: "Fin de tour",
  destroyed: "Quand elle est détruite",
};

/**
 * Réglage d'un effet : un nombre borné, une famille de cartes (« Grenouilles »), ou un texte libre (le
 * nom d'un jeton invoqué).
 */
export type EffectParam =
  | { name: string; label: string; kind: "int"; min: number; max: number; default: number }
  | { name: string; label: string; kind: "family" | "text" };

export type EffectParams = Record<string, number | string>;

export type EffectDef = {
  key: string;
  label: string;
  trigger: EffectTrigger;
  params: readonly EffectParam[];
  /** Texte proposé pour la carte, à partir des réglages. */
  text: (p: EffectParams) => string;
  /** Carte de Marvel Snap dont l'effet s'inspire, montrée dans l'admin comme repère. */
  snap?: string;
};

const amount = (label = "Puissance", def = 2): EffectParam => ({
  name: "amount",
  label,
  kind: "int",
  min: 1,
  max: 10,
  default: def,
});
const family: EffectParam = { name: "family", label: "Famille", kind: "family" };
const tokenName: EffectParam = { name: "name", label: "Nom du jeton", kind: "text" };

/** « +2 », « −2 » : le signe toujours écrit, le moins typographique. */
const signed = (n: number) => (n < 0 ? `−${-n}` : `+${n}`);
const n = (p: EffectParams, name = "amount") => Number(p[name]);
const s = (p: EffectParams, name = "family") => String(p[name]);
const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? "s" : ""}`;

export const EFFECTS = [
  // ── Puissance, sur une cible ──
  {
    key: "reveal_debuff_strongest_enemy",
    label: "Affaiblit la carte adverse la plus forte ici",
    trigger: "reveal",
    params: [amount()],
    text: (p) => `À la révélation : ${signed(-n(p))} à la carte adverse la plus forte ici.`,
  },
  {
    key: "reveal_debuff_enemies_here",
    label: "Affaiblit toutes les cartes adverses ici",
    trigger: "reveal",
    params: [amount("Puissance", 1)],
    text: (p) => `À la révélation : ${signed(-n(p))} à toutes les cartes adverses ici.`,
    snap: "Spider-Woman",
  },
  {
    key: "reveal_damage_all_here",
    label: "Affaiblit toutes les autres cartes ici, des deux côtés",
    trigger: "reveal",
    params: [amount()],
    text: (p) =>
      `À la révélation : ${signed(-n(p))} à toutes les autres cartes ici, des deux côtés.`,
  },
  {
    key: "reveal_debuff_everything",
    label: "Affaiblit toutes les autres cartes, partout",
    trigger: "reveal",
    params: [amount("Puissance", 1)],
    text: (p) =>
      `À la révélation : ${signed(-n(p))} à toutes les autres cartes en jeu, des deux côtés.`,
    snap: "Hazmat",
  },
  {
    key: "reveal_buff_allies_here",
    label: "Renforce tes autres cartes ici",
    trigger: "reveal",
    params: [amount("Puissance", 1)],
    text: (p) => `À la révélation : ${signed(n(p))} à tes autres cartes ici.`,
  },
  {
    key: "reveal_buff_random_ally",
    label: "Renforce une de tes autres cartes, au hasard",
    trigger: "reveal",
    params: [amount("Puissance", 3)],
    text: (p) => `À la révélation : ${signed(n(p))} à une de tes autres cartes en jeu, au hasard.`,
    snap: "Ironheart",
  },
  {
    key: "reveal_buff_hand",
    label: "Renforce les cartes de ta main",
    trigger: "reveal",
    params: [amount("Puissance", 1)],
    text: (p) => `À la révélation : ${signed(n(p))} aux cartes de ta main.`,
  },
  {
    key: "reveal_buff_self_if_alone",
    label: "Se renforce si elle est seule ici",
    trigger: "reveal",
    params: [amount("Puissance", 3)],
    text: (p) => `À la révélation : si c'est ta seule carte ici, ${signed(n(p))}.`,
  },
  {
    key: "reveal_buff_self_per_enemy",
    label: "Se renforce pour chaque carte adverse ici",
    trigger: "reveal",
    params: [amount("Puissance par carte", 1)],
    text: (p) => `À la révélation : ${signed(n(p))} pour chaque carte adverse ici.`,
  },
  // ── Permanents ──
  {
    key: "ongoing_buff_allies_here",
    label: "Tes autres cartes ici sont plus fortes",
    trigger: "ongoing",
    params: [amount("Puissance", 1)],
    text: (p) => `Permanent : tes autres cartes ici ont ${signed(n(p))}.`,
  },
  {
    key: "ongoing_debuff_enemies_here",
    label: "Les cartes adverses ici sont plus faibles",
    trigger: "ongoing",
    params: [amount("Puissance", 1)],
    text: (p) => `Permanent : les cartes adverses ici ont ${signed(-n(p))}.`,
  },
  {
    key: "ongoing_buff_family",
    label: "Tes cartes d'une famille sont plus fortes, partout",
    trigger: "ongoing",
    params: [family, amount("Puissance", 1)],
    text: (p) => `Permanent : tes cartes ${s(p)} ont ${signed(n(p))}.`,
    snap: "Ka-Zar",
  },
  {
    key: "ongoing_debuff_family_here",
    label: "Les cartes d'une famille sont plus faibles ici, des deux côtés",
    trigger: "ongoing",
    params: [family, amount()],
    text: (p) => `Permanent : les cartes ${s(p)} ont ${signed(-n(p))} ici, des deux côtés.`,
  },
  {
    key: "ongoing_power_per_ally_here",
    label: "Plus forte pour chaque autre de tes cartes ici",
    trigger: "ongoing",
    params: [amount("Puissance par carte", 1)],
    text: (p) => `Permanent : ${signed(n(p))} pour chaque autre de tes cartes ici.`,
  },
  {
    key: "ongoing_block_location",
    label: "Plus aucune carte ne peut être jouée ici",
    trigger: "ongoing",
    params: [],
    text: () => "Permanent : plus aucune carte ne peut être jouée ici.",
    snap: "Professor X",
  },
  // ── Fin de tour ──
  {
    key: "end_of_turn_grow",
    label: "Se renforce à chaque fin de tour",
    trigger: "end_of_turn",
    params: [amount("Puissance", 1)],
    text: (p) => `Fin de tour : ${signed(n(p))}.`,
  },
  {
    key: "end_of_turn_rotate",
    label: "Change de lieu à chaque fin de tour et se renforce",
    trigger: "end_of_turn",
    params: [amount("Puissance", 1)],
    text: (p) => `Fin de tour : passe au lieu suivant (en tournant) et gagne ${signed(n(p))}.`,
    snap: "Vision",
  },
  {
    key: "end_of_turn_debuff_enemies_here",
    label: "Affaiblit les cartes adverses ici à chaque fin de tour",
    trigger: "end_of_turn",
    params: [amount("Puissance", 1)],
    text: (p) => `Fin de tour : ${signed(-n(p))} à toutes les cartes adverses ici.`,
  },
  // ── Main, pioche, énergie ──
  {
    key: "reveal_draw",
    label: "Pioche des cartes",
    trigger: "reveal",
    params: [{ name: "count", label: "Cartes", kind: "int", min: 1, max: 3, default: 1 }],
    text: (p) => `À la révélation : pioche ${plural(n(p, "count"), "carte")}.`,
  },
  {
    key: "reveal_copy_to_hand",
    label: "Revient : une copie dans ta main",
    trigger: "reveal",
    params: [],
    text: () => "À la révélation : ajoute une copie de cette carte à ta main.",
    snap: "Arnim Zola, en plus doux",
  },
  {
    key: "reveal_enemy_energy_down",
    label: "L'adversaire a moins d'énergie au prochain tour",
    trigger: "reveal",
    params: [{ name: "amount", label: "Énergie", kind: "int", min: 1, max: 3, default: 1 }],
    text: (p) => `À la révélation : l'adversaire a ${n(p)} d'énergie en moins au prochain tour.`,
  },
  {
    key: "reveal_enemy_hand_cost_up",
    label: "Les cartes de la main adverse coûtent plus cher",
    trigger: "reveal",
    params: [{ name: "amount", label: "Coût", kind: "int", min: 1, max: 3, default: 1 }],
    text: (p) =>
      `À la révélation : les cartes de la main adverse coûtent ${signed(n(p))} au prochain tour.`,
  },
  {
    key: "reveal_hand_cost_down",
    label: "Les cartes de ta main coûtent moins cher",
    trigger: "reveal",
    params: [{ name: "amount", label: "Coût", kind: "int", min: 1, max: 3, default: 1 }],
    text: (p) =>
      `À la révélation : les cartes de ta main coûtent ${signed(-n(p))} au prochain tour.`,
  },
  // ── Contrôle ──
  {
    key: "reveal_steal_power_strongest_enemy",
    label: "Vole de la puissance à la carte adverse la plus forte ici",
    trigger: "reveal",
    params: [amount()],
    text: (p) =>
      `À la révélation : vole ${n(p)} de puissance à la carte adverse la plus forte ici.`,
    snap: "Rogue, pour la puissance",
  },
  {
    key: "reveal_destroy_weakest_enemy",
    label: "Détruit la carte adverse la plus faible ici",
    trigger: "reveal",
    params: [],
    text: () => "À la révélation : détruit la carte adverse la plus faible ici.",
  },
  {
    key: "reveal_bounce_strongest_enemy",
    label: "Renvoie la carte adverse la plus forte ici dans la main de son joueur",
    trigger: "reveal",
    params: [],
    text: () =>
      "À la révélation : renvoie la carte adverse la plus forte ici dans la main de son joueur.",
  },
  {
    key: "reveal_move_strongest_enemy",
    label: "Fait fuir la carte adverse la plus forte ici vers un autre lieu",
    trigger: "reveal",
    params: [],
    text: () => "À la révélation : la carte adverse la plus forte ici fuit vers un autre lieu.",
    snap: "Magneto",
  },
  // ── Repris de Marvel Snap ──
  {
    key: "ongoing_double_power_here",
    label: "Double ta puissance totale ici",
    trigger: "ongoing",
    params: [],
    text: () => "Permanent : ta puissance totale ici est doublée.",
    snap: "Iron Man",
  },
  {
    key: "ongoing_double_reveal_here",
    label: "Tes effets « À la révélation » ici se déclenchent deux fois",
    trigger: "ongoing",
    params: [],
    text: () =>
      "Permanent : les effets « À la révélation » de tes cartes ici se déclenchent deux fois.",
    snap: "Wong",
  },
  {
    key: "ongoing_hand_cost_down",
    label: "Les cartes de ta main coûtent moins cher",
    trigger: "ongoing",
    params: [{ name: "amount", label: "Coût", kind: "int", min: 1, max: 2, default: 1 }],
    text: (p) => `Permanent : les cartes de ta main coûtent ${signed(-n(p))} (minimum 1).`,
    snap: "Sera",
  },
  {
    key: "ongoing_protect_here",
    label: "Tes cartes ici ne peuvent pas être détruites",
    trigger: "ongoing",
    params: [],
    text: () => "Permanent : tes cartes ici ne peuvent pas être détruites.",
    snap: "Armor",
  },
  {
    key: "ongoing_grow_on_play_here",
    label: "Se renforce chaque fois que tu joues une carte ici",
    trigger: "ongoing",
    params: [amount("Puissance", 2)],
    text: (p) => `Permanent : chaque fois que tu joues une carte ici, ${signed(n(p))}.`,
    snap: "Angela",
  },
  {
    key: "ongoing_power_per_hand_card",
    label: "Plus forte pour chaque carte de ta main",
    trigger: "ongoing",
    params: [amount("Puissance par carte", 2)],
    text: (p) => `Permanent : ${signed(n(p))} pour chaque carte de ta main.`,
    snap: "Devil Dinosaur",
  },
  {
    key: "ongoing_can_move_once",
    label: "Peut changer de lieu une fois",
    trigger: "ongoing",
    params: [],
    text: () => "Permanent : tu peux la déplacer une fois vers un autre lieu.",
    snap: "Nightcrawler",
  },
  {
    // Comme dans Snap : ses propres cartes seulement, et sans faire le tour (celles du lieu de
    // gauche restent, comme celles qui n'ont pas de place).
    key: "reveal_move_allies_left",
    label: "Déplace tes autres cartes d'un lieu vers la gauche",
    trigger: "reveal",
    params: [],
    text: () => "À la révélation : déplace tes autres cartes d'un lieu vers la gauche.",
    snap: "Heimdall",
  },
  {
    key: "reveal_destroy_enemies_power_at_least",
    label: "Détruit les cartes adverses ici d'une puissance minimale",
    trigger: "reveal",
    params: [
      { name: "threshold", label: "Puissance minimale", kind: "int", min: 3, max: 15, default: 9 },
    ],
    text: (p) =>
      `À la révélation : détruit les cartes adverses ici qui ont ${n(p, "threshold")} de puissance ou plus.`,
    snap: "Shang-Chi",
  },
  {
    key: "reveal_destroy_cost",
    label: "Détruit toutes les cartes d'un coût donné, des deux côtés",
    trigger: "reveal",
    params: [{ name: "cost", label: "Coût visé", kind: "int", min: 1, max: 6, default: 1 }],
    text: (p) =>
      `À la révélation : détruit toutes les cartes de coût ${n(p, "cost")}, des deux côtés.`,
    snap: "Killmonger",
  },
  {
    key: "reveal_destroy_own_gain",
    label: "Détruit tes autres cartes ici et se renforce pour chacune",
    trigger: "reveal",
    params: [amount("Puissance par carte", 2)],
    text: (p) =>
      `À la révélation : détruit tes autres cartes ici et gagne ${signed(n(p))} pour chacune.`,
    snap: "Carnage",
  },
  {
    key: "reveal_summon_token",
    label: "Invoque un jeton dans un autre lieu",
    trigger: "reveal",
    params: [tokenName, amount("Puissance du jeton", 3)],
    text: (p) =>
      `À la révélation : ajoute ${s(p, "name")} (${n(p)} de puissance) dans un autre lieu.`,
    snap: "White Tiger",
  },
  {
    key: "reveal_add_random_card",
    label: "Ajoute une carte au hasard à ta main",
    trigger: "reveal",
    params: [],
    text: () => "À la révélation : ajoute une carte au hasard à ta main.",
    snap: "Agent 13",
  },
  {
    key: "reveal_copy_random_hand_card",
    label: "Copie une carte de ta main",
    trigger: "reveal",
    params: [],
    text: () => "À la révélation : ajoute à ta main une copie d'une carte de ta main, au hasard.",
    snap: "Moon Girl, en plus petit",
  },
  {
    key: "reveal_discard_random",
    label: "Défausse une carte de ta main, au hasard",
    trigger: "reveal",
    params: [],
    text: () => "À la révélation : défausse une carte de ta main, au hasard.",
    snap: "Blade",
  },
  {
    key: "reveal_swap_cost_power_hand",
    label: "Échange le coût et la puissance des cartes de ta main",
    trigger: "reveal",
    params: [],
    text: () => "À la révélation : échange le coût et la puissance des cartes de ta main.",
    snap: "Mister Negative",
  },
  {
    key: "reveal_silence_enemies_here",
    label: "Annule les effets des cartes adverses ici",
    trigger: "reveal",
    params: [],
    text: () => "À la révélation : les cartes adverses ici perdent leur effet.",
    snap: "Enchantress",
  },
  {
    key: "reveal_energy_next_turn",
    label: "Plus d'énergie au prochain tour",
    trigger: "reveal",
    params: [{ name: "amount", label: "Énergie", kind: "int", min: 1, max: 3, default: 1 }],
    text: (p) => `À la révélation : ${signed(n(p))} d'énergie au prochain tour.`,
    snap: "Psylocke",
  },
  {
    key: "reveal_if_no_play_here_next",
    label: "Se renforce si tu ne joues rien ici au prochain tour",
    trigger: "reveal",
    params: [amount("Puissance", 4)],
    text: (p) =>
      `À la révélation : si tu ne joues aucune carte ici au prochain tour, ${signed(n(p))}.`,
    snap: "Jessica Jones",
  },
  {
    key: "reveal_if_play_here_next",
    label: "Se renforce si tu joues une carte ici au prochain tour",
    trigger: "reveal",
    params: [amount("Puissance", 3)],
    text: (p) => `À la révélation : si tu joues une carte ici au prochain tour, ${signed(n(p))}.`,
    snap: "Hawkeye",
  },
  {
    key: "destroyed_return_stronger",
    label: "Revient dans ta main, plus forte, quand elle est détruite",
    trigger: "destroyed",
    params: [amount("Puissance gagnée", 2)],
    text: (p) => `Quand elle est détruite : revient dans ta main avec ${signed(n(p))}.`,
    snap: "Deadpool",
  },
  {
    key: "destroyed_buff_allies",
    label: "Renforce tes cartes en jeu quand elle est détruite",
    trigger: "destroyed",
    params: [amount("Puissance", 1)],
    text: (p) => `Quand elle est détruite : ${signed(n(p))} à tes cartes en jeu.`,
    snap: "Nova",
  },
] as const satisfies readonly EffectDef[];

export type EffectKey = (typeof EFFECTS)[number]["key"];

export const EFFECT_KEYS = EFFECTS.map((e) => e.key) as [EffectKey, ...EffectKey[]];

export function getEffect(key: string): EffectDef | null {
  return (EFFECTS as readonly EffectDef[]).find((e) => e.key === key) ?? null;
}

const TEXT_MAX = 40;

/** Schéma zod des réglages d'un effet, construit depuis sa liste de paramètres. */
export function paramsSchema(effect: EffectDef) {
  const shape: Record<string, z.ZodType<number | string>> = {};
  for (const param of effect.params) {
    shape[param.name] =
      param.kind === "int"
        ? z.coerce
            .number()
            .int(`${param.label} : nombre entier attendu.`)
            .min(param.min, `${param.label} : ${param.min} minimum.`)
            .max(param.max, `${param.label} : ${param.max} maximum.`)
        : z
            .string()
            .trim()
            .min(1, `${param.label} : à remplir.`)
            .max(TEXT_MAX, `${param.label} : ${TEXT_MAX} caractères maximum.`);
  }
  return z.object(shape).strict();
}

/** Réglages par défaut d'un effet (familles et textes vides). */
export function defaultParams(effect: EffectDef): EffectParams {
  return Object.fromEntries(
    effect.params.map((p) => [p.name, p.kind === "int" ? p.default : ""] as const),
  );
}

/** Texte proposé pour un effet et ses réglages, ou "" sans effet. */
export function effectText(key: string | null, params: EffectParams | null): string {
  const effect = key ? getEffect(key) : null;
  if (!effect) return "";
  return effect.text({ ...defaultParams(effect), ...params });
}
