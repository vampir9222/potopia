import { z } from "zod";

/*
 * Catalogue des effets de carte. La base ne stocke que la clé d'un effet et ses réglages
 * (`TcgCard.effectKey`, `effectParams`) : l'admin choisit l'effet dans cette liste et règle ses
 * nombres, sans déploiement. Chaque effet reprend une vraie carte de Marvel Snap (`snap`), dont
 * les valeurs servent de réglages par défaut : ces cartes sont déjà équilibrées. Un effet nouveau
 * s'ajoute ici, avec sa carte Snap, puis se donne à n'importe quelle carte. Le moteur de partie (à
 * venir) lira la même liste.
 */

/** Moment où l'effet agit. */
export type EffectTrigger =
  "reveal" | "ongoing" | "end_of_turn" | "destroyed" | "hand" | "end_of_game";

export const TRIGGER_LABELS: Record<EffectTrigger, string> = {
  reveal: "Révélation",
  ongoing: "Permanent",
  end_of_turn: "Fin de tour",
  destroyed: "Quand elle est détruite",
  hand: "Depuis la main",
  end_of_game: "Fin de partie",
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
  /** Carte de Marvel Snap dont l'effet est repris, montrée dans l'admin comme repère. */
  snap: string;
};

const amount = (label = "Puissance", def = 2): EffectParam => ({
  name: "amount",
  label,
  kind: "int",
  min: 1,
  max: 10,
  default: def,
});
const tokenName: EffectParam = { name: "name", label: "Nom du jeton", kind: "text" };

/** « +2 », « −2 » : le signe toujours écrit, le moins typographique. */
const signed = (n: number) => (n < 0 ? `−${-n}` : `+${n}`);
const n = (p: EffectParams, name = "amount") => Number(p[name]);
const s = (p: EffectParams, name = "name") => String(p[name]);

/** Effet sans réglage. */
function fixed<K extends string>(
  key: K,
  trigger: EffectTrigger,
  snap: string,
  label: string,
  text: string,
) {
  return { key, trigger, snap, label, params: [], text: () => text } as const;
}

export const EFFECTS = [
  // ── Révélation ──
  {
    key: "reveal_debuff_enemies_here",
    label: "Affaiblit toutes les cartes adverses ici",
    trigger: "reveal",
    params: [amount("Puissance", 1)],
    text: (p) => `Révélation : ${signed(-n(p))} à toutes les cartes adverses ici.`,
    snap: "Spider-Woman",
  },
  {
    key: "reveal_steal_power_all_here",
    label: "Vole de la puissance à chaque autre carte ici, des deux côtés",
    trigger: "reveal",
    params: [amount("Puissance", 1)],
    text: (p) => `Révélation : vole ${n(p)} de puissance à chaque autre carte ici.`,
    snap: "Laufey",
  },
  {
    key: "reveal_debuff_everything",
    label: "Affaiblit toutes les autres cartes, partout",
    trigger: "reveal",
    params: [amount("Puissance", 1)],
    text: (p) => `Révélation : ${signed(-n(p))} à toutes les autres cartes en jeu.`,
    snap: "Hazmat",
  },
  {
    key: "reveal_buff_allies_here",
    label: "Renforce tes cartes ici ; coûte moins par carte déplaçable jouée",
    trigger: "reveal",
    params: [amount("Puissance", 3)],
    text: (p) =>
      `Révélation : ${signed(n(p))} à tes cartes ici. Coûte 1 de moins par carte déplaçable que tu as jouée.`,
    snap: "Spider Sense",
  },
  {
    key: "reveal_buff_two_allies",
    label: "Renforce plusieurs de tes autres cartes en jeu",
    trigger: "reveal",
    params: [
      amount("Puissance", 3),
      { name: "count", label: "Cartes", kind: "int", min: 1, max: 3, default: 2 },
    ],
    text: (p) => `Révélation : ${signed(n(p))} à ${n(p, "count")} de tes autres cartes.`,
    snap: "Ironheart",
  },
  {
    key: "reveal_buff_hand",
    label: "Renforce les cartes de ta main",
    trigger: "reveal",
    params: [amount("Puissance", 2)],
    text: (p) => `Révélation : ${signed(n(p))} aux cartes de ta main.`,
    snap: "Nakia",
  },
  fixed(
    "reveal_draw",
    "reveal",
    "Crystal",
    "Chaque joueur pioche une carte",
    "Révélation : chaque joueur pioche une carte.",
  ),
  fixed(
    "reveal_copy_to_hand",
    "reveal",
    "Sentinel",
    "Ajoute une autre copie de cette carte à ta main",
    "Révélation : ajoute une autre copie de cette carte à ta main.",
  ),
  fixed(
    "reveal_enemy_card_cost_up",
    "reveal",
    "Iceman",
    "Une carte de la main adverse coûte plus cher",
    "Révélation : une carte de la main adverse coûte 1 de plus (6 maximum).",
  ),
  fixed(
    "reveal_move_strongest_enemy",
    "reveal",
    "Cannonball",
    "Chasse la carte adverse la plus forte ici, sinon l'écrase sous un Rocher",
    "Révélation : la carte adverse la plus forte ici part ailleurs. Sinon, un Rocher la détruit.",
  ),
  // Comme dans Snap : ses propres cartes seulement, et sans faire le tour (celles du lieu de
  // gauche restent, comme celles qui n'ont pas de place).
  fixed(
    "reveal_move_allies_left",
    "reveal",
    "Heimdall",
    "Déplace tes autres cartes d'un lieu vers la gauche",
    "Révélation : déplace tes autres cartes d'un lieu vers la gauche.",
  ),
  fixed(
    "reveal_destroy_enemy_power_10",
    "reveal",
    "Shang-Chi",
    "Détruit une carte adverse ici de 10 de puissance ou plus",
    "Révélation : détruit une carte adverse ici qui a 10 de puissance ou plus.",
  ),
  fixed(
    "reveal_destroy_all_one_cost",
    "reveal",
    "Killmonger",
    "Détruit toutes les cartes à 1 coût, partout",
    "Révélation : détruit TOUTES les cartes à 1 coût.",
  ),
  {
    key: "reveal_destroy_own_gain",
    label: "Détruit tes autres cartes ici et se renforce pour chacune",
    trigger: "reveal",
    params: [amount("Puissance par carte", 2)],
    text: (p) =>
      `Révélation : détruit tes autres cartes ici et gagne ${signed(n(p))} pour chacune.`,
    snap: "Carnage",
  },
  {
    key: "reveal_summon_token",
    label: "Ajoute un jeton de 10 dans un autre lieu",
    trigger: "reveal",
    params: [tokenName],
    text: (p) => `Révélation : ajoute ${s(p)} (10 de puissance) dans un autre lieu.`,
    snap: "White Tiger",
  },
  fixed(
    "reveal_add_random_card",
    "reveal",
    "Agent 13",
    "Ajoute une carte au hasard à ta main",
    "Révélation : ajoute une carte au hasard à ta main.",
  ),
  fixed(
    "reveal_copy_leftmost_hand_card",
    "reveal",
    "Mother Askani",
    "Copie la carte la plus à gauche de ta main (−1 coût, +2)",
    "Révélation : copie la carte la plus à gauche de ta main, avec −1 coût et +2.",
  ),
  fixed(
    "reveal_discard_rightmost",
    "reveal",
    "Blade",
    "Défausse la carte la plus à droite de ta main",
    "Révélation : défausse la carte la plus à droite de ta main.",
  ),
  fixed(
    "reveal_swap_cost_power_deck",
    "reveal",
    "Mister Negative",
    "Échange le coût et la puissance des cartes de ta pioche",
    "Révélation : échange le coût et la puissance des cartes de ta pioche.",
  ),
  fixed(
    "reveal_silence_ongoing_here",
    "reveal",
    "Enchantress",
    "Retire les capacités des cartes Permanent ici, des deux côtés",
    "Révélation : retire les capacités de toutes les cartes Permanent ici.",
  ),
  {
    key: "reveal_energy_next_turn",
    label: "Plus d'énergie au prochain tour",
    trigger: "reveal",
    params: [{ name: "amount", label: "Énergie", kind: "int", min: 1, max: 3, default: 1 }],
    text: (p) => `Révélation : ${signed(n(p))} d'énergie au prochain tour.`,
    snap: "Psylocke",
  },
  {
    key: "reveal_if_no_play_here_next",
    label: "Se renforce si tu ne joues rien ici au prochain tour",
    trigger: "reveal",
    params: [amount("Puissance", 5)],
    text: (p) => `Révélation : si tu ne joues aucune carte ici au prochain tour, ${signed(n(p))}.`,
    snap: "Jessica Jones",
  },
  {
    key: "reveal_if_play_here_next",
    label: "Se renforce si tu joues une carte ici au prochain tour",
    trigger: "reveal",
    params: [amount("Puissance", 4)],
    text: (p) => `Révélation : si tu joues une carte ici au prochain tour, ${signed(n(p))}.`,
    snap: "Hawkeye",
  },
  fixed(
    "reveal_pull_enemies_cost_3_4",
    "reveal",
    "Magneto",
    "Attire ici toutes les cartes adverses à 3 et 4 coûts",
    "Révélation : toutes les cartes adverses à 3 et 4 coûts viennent ici.",
  ),
  fixed(
    "reveal_silence_unrevealed_enemies_here",
    "reveal",
    "Alioth",
    "Retire le texte des cartes adverses pas encore révélées ici",
    "Révélation : retire le texte des cartes adverses non révélées ici.",
  ),
  fixed(
    "reveal_flood_location",
    "reveal",
    "Storm",
    "Inonde ce lieu : on n'y joue plus qu'un tour",
    "Révélation : inonde ce lieu. Le prochain tour est le dernier où l'on peut y jouer.",
  ),
  fixed(
    "reveal_destroy_other_locations",
    "reveal",
    "Galactus",
    "Seule et gagnante ici : détruit les autres lieux",
    "Révélation : si tu gagnes ici et que c'est ta seule carte ici, détruit les autres lieux.",
  ),
  fixed(
    "reveal_move_and_pull_enemy",
    "reveal",
    "Spider-Man",
    "Part dans un autre lieu en y entraînant une carte adverse",
    "Révélation : part dans un autre lieu et y entraîne une carte adverse d'ici.",
  ),
  {
    key: "reveal_debuff_weakest_enemy_silence",
    label: "Affaiblit la carte adverse la plus faible ici et retire son texte",
    trigger: "reveal",
    params: [amount("Puissance", 2)],
    text: (p) =>
      `Révélation : ${signed(-n(p))} à la carte adverse la plus faible ici, et retire son texte.`,
    snap: "Red Guardian",
  },
  fixed(
    "reveal_all_costs_up_next_turn",
    "reveal",
    "Sandman",
    "Au prochain tour, toutes les cartes coûtent plus cher",
    "Révélation : au prochain tour, les cartes coûtent 1 de plus (6 maximum).",
  ),
  fixed(
    "reveal_merge_into_ally_here",
    "reveal",
    "Hulkbuster",
    "Fusionne avec une de tes cartes ici",
    "Révélation : fusionne avec une de tes cartes ici.",
  ),
  {
    key: "reveal_add_clones_here",
    label: "Ajoute ici deux jetons de même puissance",
    trigger: "reveal",
    params: [tokenName],
    text: (p) => `Révélation : ajoute ici 2 ${s(p)}, de même puissance qu'elle.`,
    snap: "Brood",
  },
  fixed(
    "reveal_last_played_moves_here",
    "reveal",
    "Ghost-Spider",
    "Ta dernière carte jouée vient ici",
    "Révélation : la dernière carte que tu as jouée vient ici.",
  ),
  fixed(
    "reveal_set_all_here_to_3",
    "reveal",
    "Valkyrie",
    "Toutes les cartes ici passent à 3 de puissance",
    "Révélation : TOUTES les cartes ici passent à 3 de puissance.",
  ),
  fixed(
    "reveal_destroy_own_other_locations",
    "reveal",
    "Destroyer",
    "Détruit tes cartes dans les autres lieux",
    "Révélation : détruit tes cartes dans les autres lieux.",
  ),
  fixed(
    "reveal_reset_power_here",
    "reveal",
    "Shadow King",
    "Les cartes ici reviennent à leur puissance d'origine",
    "Révélation : toutes les cartes ici reviennent à leur puissance d'origine.",
  ),
  fixed(
    "reveal_repeat_reveals_here",
    "reveal",
    "Odin",
    "Répète les effets Révélation de tes autres cartes ici",
    "Révélation : répète les effets Révélation de tes autres cartes ici.",
  ),
  {
    key: "reveal_power_per_ally_here",
    label: "Se renforce pour chaque autre de tes cartes ici",
    trigger: "reveal",
    params: [amount("Puissance par carte", 2)],
    text: (p) => `Révélation : ${signed(n(p))} pour chaque autre de tes cartes ici.`,
    snap: "Wolfsbane",
  },
  fixed(
    "reveal_destroy_power_at_most_here",
    "reveal",
    "Lady Deathstrike",
    "Détruit les cartes ici de 3 de puissance ou moins",
    "Révélation : détruit chaque carte ici qui a 3 de puissance ou moins.",
  ),
  fixed(
    "reveal_move_away_enemies_played_here",
    "reveal",
    "Juggernaut",
    "Chasse les cartes adverses jouées ici ce tour",
    "Révélation : les cartes adverses jouées ici ce tour partent ailleurs (même non révélées).",
  ),
  fixed(
    "reveal_copy_strongest_enemy_played",
    "reveal",
    "Leader",
    "Copie de ton côté la plus forte carte adverse jouée ce tour",
    "Révélation : copie de ton côté la ou les cartes adverses les plus fortes jouées ce tour.",
  ),
  fixed(
    "reveal_destroy_enemy_one_cost_here",
    "reveal",
    "Elektra",
    "Détruit une carte adverse à 1 coût ici",
    "Révélation : détruit une carte adverse à 1 coût ici.",
  ),
  fixed(
    "reveal_power_to_next_card",
    "reveal",
    "Stick",
    "Ta prochaine carte jouée gagne autant de puissance que celle-ci",
    "Révélation : ta prochaine carte jouée gagne autant de puissance que celle-ci.",
  ),
  fixed(
    "reveal_recruit_cheapest_enemy_deck",
    "reveal",
    "Baron Zemo",
    "La carte la moins chère de la pioche adverse rejoint ton côté",
    "Révélation : la carte la moins chère de la pioche adverse rejoint ton côté, ici.",
  ),
  fixed(
    "reveal_draw_from_enemy_deck",
    "reveal",
    "Cable",
    "Pioche une carte de la pioche adverse",
    "Révélation : pioche une carte de la pioche adverse.",
  ),
  fixed(
    "reveal_move_enemy_right",
    "reveal",
    "Stegron",
    "Déplace une carte adverse d'ici d'un lieu vers la droite",
    "Révélation : déplace une carte adverse d'ici d'un lieu vers la droite.",
  ),
  {
    key: "reveal_add_clone_here",
    label: "Ajoute ici un clone de même puissance",
    trigger: "reveal",
    params: [tokenName],
    text: (p) => `Révélation : ajoute ici ${s(p)}, un clone de même puissance.`,
    snap: "Mister Sinister",
  },
  fixed(
    "reveal_return_discarded_here",
    "reveal",
    "Ghost Rider",
    "Ramène ici une de tes cartes défaussées",
    "Révélation : ramène ici une de tes cartes défaussées.",
  ),
  fixed(
    "reveal_banish_top_add_rocks",
    "reveal",
    "Mole Man",
    "Bannit le dessus de ta pioche et te donne deux Rochers",
    "Révélation : bannit le dessus de ta pioche ; 2 Rochers en main, de puissance égale à son coût.",
  ),
  fixed(
    "reveal_cost_cap_4",
    "reveal",
    "Wave",
    "Toutes les cartes coûtent 4 au plus jusqu'à la fin du prochain tour",
    "Révélation : toutes les cartes coûtent 4 au maximum jusqu'à la fin du prochain tour.",
  ),
  fixed(
    "reveal_set_hand_power_3",
    "reveal",
    "Bast",
    "Les cartes de ta main passent à 3 de puissance",
    "Révélation : les cartes de ta main passent à 3 de puissance.",
  ),
  // ── Permanent ──
  {
    key: "ongoing_buff_allies_here",
    label: "Tes autres cartes Permanent ici sont plus fortes",
    trigger: "ongoing",
    params: [amount("Puissance", 2)],
    text: (p) => `Permanent : tes autres cartes Permanent ici ont ${signed(n(p))}.`,
    snap: "Captain America",
  },
  {
    key: "ongoing_buff_one_cost",
    label: "Tes cartes à 1 coût sont plus fortes",
    trigger: "ongoing",
    params: [amount("Puissance", 1)],
    text: (p) => `Permanent : tes cartes à 1 coût ont ${signed(n(p))}.`,
    snap: "Ka-Zar",
  },
  {
    key: "ongoing_debuff_cheap_here",
    label: "Les cartes à 3 coûts ou moins ici sont plus faibles, des deux côtés",
    trigger: "ongoing",
    params: [amount("Puissance", 2)],
    text: (p) => `Permanent : les cartes à 3 coûts ou moins ici ont ${signed(-n(p))}.`,
    snap: "Man-Thing",
  },
  fixed(
    "ongoing_block_location",
    "ongoing",
    "Professor X",
    "Seul un déplacement peut ajouter ou retirer une carte ici",
    "Permanent : seul un déplacement peut ajouter ou retirer une carte ici.",
  ),
  fixed(
    "ongoing_double_power_here",
    "ongoing",
    "Iron Man",
    "Double ta puissance totale ici",
    "Permanent : ta puissance totale ici est doublée.",
  ),
  fixed(
    "ongoing_double_reveal_here",
    "ongoing",
    "Wong",
    "Tes effets Révélation ici se déclenchent deux fois",
    "Permanent : les effets Révélation de tes cartes ici se déclenchent deux fois.",
  ),
  {
    key: "ongoing_hand_cost_down",
    label: "Les cartes de ta main coûtent moins cher",
    trigger: "ongoing",
    params: [{ name: "amount", label: "Coût", kind: "int", min: 1, max: 2, default: 1 }],
    text: (p) => `Permanent : les cartes de ta main coûtent ${signed(-n(p))} (minimum 1).`,
    snap: "Sera",
  },
  fixed(
    "ongoing_protect_here",
    "ongoing",
    "Armor",
    "Les cartes ici ne peuvent pas être détruites, des deux côtés",
    "Permanent : les cartes ici ne peuvent pas être détruites.",
  ),
  {
    key: "ongoing_grow_on_play_here",
    label: "Se renforce chaque fois que tu joues une carte ici",
    trigger: "ongoing",
    params: [amount("Puissance", 1)],
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
  fixed(
    "ongoing_can_move_once",
    "ongoing",
    "Nightcrawler",
    "Peut changer de lieu une fois",
    "Permanent : tu peux la déplacer une fois vers un autre lieu.",
  ),
  fixed(
    "ongoing_move_away_cost_3_4_played_here",
    "ongoing",
    "Xorn",
    "Les cartes à 3 ou 4 coûts jouées ici partent ailleurs",
    "Permanent : après qu'une carte à 3 ou 4 coûts est jouée ici, elle part dans un autre lieu.",
  ),
  {
    key: "ongoing_power_per_location_with_destroyed",
    label: "Plus forte pour chaque lieu où une de tes cartes a été détruite",
    trigger: "ongoing",
    params: [amount("Puissance par lieu", 3)],
    text: (p) => `Permanent : ${signed(n(p))} par lieu où une de tes cartes a été détruite.`,
    snap: "Muse",
  },
  fixed(
    "ongoing_hide_plays_here",
    "ongoing",
    "Invisible Woman",
    "Tes cartes jouées ici restent cachées jusqu'à la fin de la partie",
    "Permanent : les cartes que tu joues ici ne sont révélées qu'à la fin de la partie.",
  ),
  {
    key: "ongoing_power_per_enemy_here",
    label: "Plus forte pour chaque carte adverse ici",
    trigger: "ongoing",
    params: [amount("Puissance par carte", 1)],
    text: (p) => `Permanent : ${signed(n(p))} pour chaque carte adverse ici.`,
    snap: "Punisher",
  },
  fixed(
    "ongoing_first_card_here",
    "ongoing",
    "Jean Grey",
    "Chaque joueur doit jouer sa première carte du tour ici",
    "Permanent : chaque joueur doit jouer sa première carte du tour ici (si possible).",
  ),
  fixed(
    "ongoing_split_power_evenly",
    "ongoing",
    "The Living Tribunal",
    "Ta puissance totale est répartie à parts égales entre les lieux",
    "Permanent : ta puissance totale est répartie à parts égales entre tous les lieux.",
  ),
  fixed(
    "ongoing_unshakable",
    "ongoing",
    "Colossus",
    "Ne peut être ni détruite, ni déplacée, ni affaiblie",
    "Permanent : ne peut être ni détruite, ni déplacée, ni affaiblie.",
  ),
  fixed(
    "ongoing_see_plays_turn_5",
    "ongoing",
    "Daredevil",
    "Au tour 5, tu vois ce que joue l'adversaire",
    "Permanent : au tour 5, tu vois ce que joue l'adversaire avant de jouer.",
  ),
  fixed(
    "ongoing_no_reveals_here",
    "ongoing",
    "Cosmo",
    "Les effets Révélation ne se déclenchent pas ici",
    "Permanent : les effets Révélation ne se déclenchent pas ici.",
  ),
  fixed(
    "ongoing_enemies_here_cant_move",
    "ongoing",
    "Mercury",
    "Déplaçable une fois ; les cartes adverses ici ne bougent plus",
    "Permanent : déplaçable une fois. Les cartes adverses ici ne peuvent pas bouger.",
  ),
  fixed(
    "ongoing_moves_when_card_played_here",
    "ongoing",
    "Silk",
    "Part dans un autre lieu après chaque carte jouée ici",
    "Permanent : après chaque carte jouée ici (par n'importe qui), part dans un autre lieu.",
  ),
  {
    key: "ongoing_buff_if_both_sides_full",
    label: "Plus forte si les deux côtés du lieu sont pleins",
    trigger: "ongoing",
    params: [amount("Puissance", 6)],
    text: (p) => `Permanent : si les deux côtés ici sont pleins, ${signed(n(p))}.`,
    snap: "Mojo",
  },
  // ── Fin de tour ──
  {
    key: "end_of_turn_grow",
    label: "Se renforce à chaque fin de tour ; double une fois si ton côté est plein",
    trigger: "end_of_turn",
    params: [amount("Puissance", 1)],
    text: (p) =>
      `Fin de tour : ${signed(n(p))}. Une fois par partie, si ton côté ici est plein, double plutôt sa puissance.`,
    snap: "Human Torch First Steps",
  },
  fixed(
    "end_of_turn_discard_self_from_hand",
    "end_of_turn",
    "Black Cat",
    "Se défausse de ta main en fin de tour",
    "Fin de tour : se défausse de ta main.",
  ),
  {
    key: "end_of_turn_damage_all_here",
    label: "Affaiblit les autres cartes ici et détruit les tiennes tombées à 0",
    trigger: "end_of_turn",
    params: [amount("Puissance", 1)],
    text: (p) =>
      `Fin de tour : ${signed(-n(p))} à toutes les autres cartes ici, puis détruit tes autres cartes ici à 0 ou moins.`,
    snap: "Hellcow Fractured Frontier",
  },
  fixed(
    "end_of_turn_double_if_losing",
    "end_of_turn",
    "Isca the Unbeaten",
    "Double sa puissance si tu perds ce lieu",
    "Fin de tour : si tu perds ce lieu, double sa puissance.",
  ),
  // ── Quand elle est détruite ──
  fixed(
    "destroyed_return_stronger",
    "destroyed",
    "Deadpool",
    "Revient dans ta main avec sa puissance doublée",
    "Détruite : revient dans ta main avec sa puissance doublée.",
  ),
  {
    key: "destroyed_buff_allies",
    label: "Renforce tes cartes en jeu quand elle est détruite",
    trigger: "destroyed",
    params: [amount("Puissance", 1)],
    text: (p) => `Détruite : ${signed(n(p))} à tes cartes en jeu.`,
    snap: "Nova",
  },
  // ── Depuis la main ──
  fixed(
    "hand_replace_destroyed_ally",
    "hand",
    "Angel",
    "Remplace une de tes cartes détruites, depuis ta main ou ta pioche",
    "Quand une de tes cartes est détruite, quitte ta main ou ta pioche pour la remplacer.",
  ),
  fixed(
    "hand_cost_down_per_big_ally",
    "hand",
    "Skaar",
    "Coûte moins pour chacune de tes cartes de 10 de puissance ou plus",
    "Coûte 2 de moins pour chacune de tes cartes à 10 de puissance ou plus.",
  ),
  fixed(
    "hand_cost_down_per_destroyed",
    "hand",
    "Death",
    "Coûte moins pour chaque carte détruite dans la partie",
    "Coûte 1 de moins pour chaque carte détruite dans la partie.",
  ),
  fixed(
    "hand_cost_down_per_card_last_turn",
    "hand",
    "Sasquatch",
    "Coûte moins pour chaque carte jouée au tour précédent",
    "Coûte 1 de moins pour chaque carte que tu as jouée au tour précédent.",
  ),
  // ── Fin de partie ──
  fixed(
    "end_of_game_move_to_win",
    "end_of_game",
    "Captain Marvel",
    "Se déplace vers un lieu qui te fait gagner",
    "Fin de partie : se déplace vers un lieu qui te fait gagner la partie (si possible).",
  ),
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
