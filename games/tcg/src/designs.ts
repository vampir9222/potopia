/**
 * Propositions de design de carte, notées par les membres. L'identifiant est stocké avec chaque
 * note : ne jamais le renommer (ajouter une nouvelle entrée à la place).
 */
export const DESIGNS = [
  {
    id: "pixel",
    title: "Pixel arcade",
    summary: "Cadre en pixels, polices rétro, même style que la boule.",
  },
  { id: "comics", title: "Comics", summary: "Contours noirs épais, trame, bulle pour le nom." },
  {
    id: "fantasy",
    title: "Fantasy dorée",
    summary: "Parchemin, cadre doré, gemme de coût et écu de puissance.",
  },
  {
    id: "minimal",
    title: "Minimal photo",
    summary: "Photo plein cadre, bandeau sombre, pastilles.",
  },
  {
    id: "polaroid",
    title: "Polaroid entre potes",
    summary: "Photo instantanée scotchée, écriture manuscrite.",
  },
  {
    id: "speciales",
    title: "Lieu, légendaire, fusion",
    summary: "Variantes de cartes : lieu, légendaire, fusion.",
  },
  {
    id: "raretes",
    title: "Rareté cosmétique",
    summary: "Même carte en 4 raretés : seul le look change.",
  },
  {
    id: "snap",
    title: "Snap : art plein cadre",
    summary:
      "L'illustration occupe toute la carte, gemme de coût et éclat de puissance, holo animé.",
  },
  {
    id: "hearth",
    title: "Taverne : portrait ovale",
    summary:
      "Cadre de pierre et d'or, portrait ovale, ruban du nom, cristal de mana, gemme de rareté.",
  },
  {
    id: "poke",
    title: "Poké : bord jaune",
    summary:
      "Fond de la couleur de la famille, puissance en PV, coût en énergies, illustration holo.",
  },
  {
    id: "magic",
    title: "Arcanes : cadre de couleur",
    summary: "Bordure noire, cadre teinté, symbole d'édition de la couleur de la rareté.",
  },
  {
    id: "snap-classic",
    title: "Snap · Classique",
    summary:
      "Coût en rond bleu, puissance en hexagone jaune, cadre métal selon la finition. Effet au survol.",
  },
  {
    id: "snap-ink",
    title: "Snap · Encre",
    summary: "Illustration en noir et blanc encré, trame, teinte de la famille, cadre d'encre.",
  },
  {
    id: "snap-neon",
    title: "Snap · Néon",
    summary: "Photo assombrie, lignes de balayage, liseré et nom qui brillent comme un néon.",
  },
  {
    id: "snap-pixel",
    title: "Snap · Pixel",
    summary: "Photo en mosaïque de pixels, cadre et nom rétro : dans l'esprit de la boule.",
  },
  {
    id: "snap-prism",
    title: "Snap · Prisme",
    summary: "Cadre arc-en-ciel qui tourne lentement, nom chromé.",
  },
  {
    id: "snap-raretes",
    title: "Snap · De commune à SSR",
    summary:
      "Les 6 finitions : la légendaire brille d'un éclat doré, la SR sort du cadre, la SSR vole en éclats au survol.",
  },
  {
    id: "snap-gold",
    title: "Snap · Or massif",
    summary: "Tout en or : illustration dorée, cadre et nom en or massif.",
  },
  {
    id: "snap-kawaii",
    title: "Snap · Kawaii",
    summary: "Cadre pastel arrondi, autocollants étoiles et cœurs, nom tout rond.",
  },
  {
    id: "snap-popart",
    title: "Snap · Pop art",
    summary: "Couleurs postérisées, trame rouge, cadre jaune et noir façon BD pop.",
  },
  {
    id: "snap-glitch",
    title: "Snap · Glitch",
    summary: "Couches rouge et cyan décalées ; au survol, des tranches de l'image sautent.",
  },
  {
    id: "snap-watercolor",
    title: "Snap · Aquarelle",
    summary: "Illustration aux bords qui bavent sur papier, nom manuscrit.",
  },
  {
    id: "snap-sketch",
    title: "Snap · Croquis",
    summary: "Photo transformée en dessin au crayon sur papier ligné.",
  },
  {
    id: "snap-cosmic",
    title: "Snap · Cosmique",
    summary: "Le sujet flotte dans l'espace, nébuleuse et étoiles, cadre violet lumineux.",
  },
  {
    id: "snap-borderless",
    title: "Snap · Sans bordure",
    summary: "Aucun cadre : l'image d'abord, nom géant à la verticale.",
  },
  {
    id: "snap-stained",
    title: "Snap · Vitrail",
    summary: "Couleurs en aplats et plombs noirs, cadre en verre coloré.",
  },
  {
    id: "snap-theme",
    title: "Snap · Thème du site",
    summary: "Cadre et nom aux couleurs du thème choisi (Classique, Fantasy, RGB…).",
  },
  {
    id: "snap-edition",
    title: "Snap · Édition",
    summary:
      "Le Snap classique avec un bandeau : numéro dans la série, symbole de rareté et auteur de l'idée.",
  },
  {
    id: "snap-raretes-v2",
    title: "Snap · Raretés v2",
    summary:
      "Nouvelle SR (le sujet sort de la carte, gravure nacrée) et nouvelle SSR lenticulaire : l'image bascule en néon quand on penche la carte.",
  },
  {
    id: "snap-gold-spot",
    title: "Snap · Or, sujet en couleur",
    summary:
      "Tout est doré sauf le centre de l'image, où se trouve le sujet : il garde ses couleurs.",
  },
  {
    id: "snap-cosmic-frame",
    title: "Snap · Bordure cosmique",
    summary:
      "L'image reste intacte ; la nébuleuse étoilée est dans la bordure et déborde de la carte.",
  },
  {
    id: "snap-watercolor-frame",
    title: "Snap · Aquarelle encadrée",
    summary: "Illustration à l'aquarelle, avec le cadre et le nom du Snap classique.",
  },
  {
    id: "snap-variantes",
    title: "Snap · Variantes",
    summary: "La même carte en variantes à collectionner : néon, glitch, prisme et or.",
  },
  {
    id: "hearth-snap",
    title: "Taverne · badges Snap",
    summary:
      "Portrait ovale et ruban de la Taverne, coût en rond bleu et puissance en hexagone jaune.",
  },
  {
    id: "magic-snap",
    title: "Arcanes · badges Snap",
    summary: "Cadre des Arcanes (numéro, rareté, auteur), coût et puissance façon Snap.",
  },
  {
    id: "snap-v2-sculpte",
    title: "Snap V2 · Cadre sculpté",
    summary: "Cadre épais en relief et biseauté, badges sertis de métal, plaque de nom gravée.",
  },
  {
    id: "snap-v3-infini",
    title: "Snap V3 · Infini",
    summary: "Un liseré d'énergie court sans fin autour de la carte, halo intérieur qui respire.",
  },
  {
    id: "snap-v4-profondeur",
    title: "Snap V4 · Profondeur",
    summary:
      "Trois plans : fond flou loin derrière, cadre, sujet net devant. Penche la carte : il se détache.",
  },
  {
    id: "arcanes-v2",
    title: "Arcanes V2 · Plein cadre",
    summary:
      "Illustration plein cadre façon Snap, barres et texte des Arcanes en verre fumé, numéro et auteur.",
  },
  {
    id: "taverne-v2",
    title: "Taverne V2 · Arche",
    summary: "Portrait en arche dorée, pierre sculptée, torches qui vacillent, badges Snap.",
  },
  {
    id: "potomon",
    title: "Poké V2 · Potomon",
    summary:
      "Les PV et les énergies, dans un style à nous : bord blanc, bandeau en biais, photo scotchée.",
  },
  {
    id: "cosmique-v3",
    title: "Cosmique V3 · Aurore",
    summary:
      "L'image reste intacte ; une aurore et des étoiles dansent derrière et autour de la carte.",
  },
  {
    id: "neon-v2",
    title: "Néon V2 · Enseigne",
    summary: "Tube de néon en cadre sur mur de briques, nom manuscrit qui grésille.",
  },
  {
    id: "raretes-v3",
    title: "Raretés V3 · Signées",
    summary:
      "Le cadre sculpté de commune à SSR ; SR et SSR signées par l'auteur de l'idée, SSR lenticulaire.",
  },
  {
    id: "essai-duel",
    title: "Essai · Duel",
    summary:
      "Façon carte de duel : nom en haut, étoiles de niveau pour le coût, encadré de type, puissance en bas.",
  },
  {
    id: "essai-tarot",
    title: "Essai · Tarot",
    summary:
      "Lame de tarot : ivoire, double filet, fenêtre en ogive, chiffre romain, médaillons gravés.",
  },
  {
    id: "essai-balatro",
    title: "Essai · Balatro",
    summary:
      "La carte se balance, bord blanc épais, image pixelisée en écran cathodique, jetons bleu et rouge.",
  },
  {
    id: "mix-verre",
    title: "Mix · Sculpté et verre fumé",
    summary:
      "Le cadre sculpté et les badges sertis du 44, la plaque de nom gravée, le texte des Arcanes en verre fumé (39).",
  },
  {
    id: "mix-serti",
    title: "Mix · Arcanes serti",
    summary:
      "La mise en page des Arcanes (39) : nom en haut, ligne de type, encadré de texte ; dans le cadre sculpté du 44.",
  },
  {
    id: "mix-plaque",
    title: "Mix · Plaque et parchemin",
    summary:
      "Plaque de nom gravée en haut entre les badges, texte sur parchemin ivoire à l'encre sombre.",
  },
  {
    id: "effets-metaux",
    title: "Effets · Métaux précieux",
    summary:
      "Le cadre change de métal : acier, émeraude, améthyste, or, nacre, prisme. Holo dès la rare, reflet sur la légendaire, gravure nacrée sur la SR, SSR lenticulaire. SR et SSR signées.",
  },
  {
    id: "effets-gemmes",
    title: "Effets · Bronze et gemmes",
    summary:
      "Même cadre de bronze pour toutes ; la rareté se lit à la gemme (plus grosse) et au liseré intérieur coloré. Mêmes holo, reflet, gravure et signatures.",
  },
  {
    id: "effets-lumiere",
    title: "Effets · Lumière vivante",
    summary:
      "Cadre d'acier sombre pour toutes ; un liseré de lumière tourne autour de la carte, de plus en plus riche avec la rareté. Mêmes holo, reflet, gravure et signatures.",
  },
  {
    id: "effets-cosmique",
    title: "Effets · Cosmique",
    summary:
      "D'après le 42 (« plutôt pour une rareté ») : métaux jusqu'à la rare, puis une aurore et des étoiles vivantes autour de la carte pour la légendaire, la SR et la SSR. L'image reste intacte ; la lumière déborde du cadre et entre un peu dedans.",
  },
  {
    id: "haut-creuse",
    title: "Titre en haut · fenêtre creusée",
    summary:
      "La base du 48, titre en haut ; l'image est enfoncée dans la carte (ombre intérieure), sans cadre autour. Chaque ligne : puissance en bas puis en haut, en carte normale et en full art.",
  },
  {
    id: "haut-fondu",
    title: "Titre en haut · image fondue",
    summary:
      "Pas de bord à la fenêtre : le bas de l'image se fond dans le panneau sombre de la carte. Chaque ligne : puissance en bas puis en haut, en carte normale et en full art.",
  },
  {
    id: "haut-grave",
    title: "Titre en haut · fenêtre gravée",
    summary:
      "La fenêtre est taillée dans la carte : biseau inversé, ombre en haut à gauche, lumière en bas à droite. Chaque ligne : puissance en bas puis en haut, en carte normale et en full art.",
  },
  {
    id: "haut-continu",
    title: "Titre en haut · cadre au niveau de la bordure",
    summary:
      "Un fin cadre du même métal que la bordure, au même niveau qu'elle, plutôt qu'un cadre posé dessus. Chaque ligne : puissance en bas puis en haut, en carte normale et en full art.",
  },
  {
    id: "haut-large",
    title: "Titre en haut · image d'un bord à l'autre",
    summary:
      "L'image va d'un bord à l'autre du cadre, sans marge ni cadre, enfoncée entre le titre et la ligne de type. Chaque ligne : puissance en bas puis en haut, en carte normale et en full art.",
  },
  {
    id: "haut-arche",
    title: "Titre en haut · fenêtre en arche",
    summary:
      "Le haut de la fenêtre forme une arche, enfoncée dans la carte. Chaque ligne : puissance en bas puis en haut, en carte normale et en full art.",
  },
  {
    id: "haut-coins",
    title: "Titre en haut · coins coupés",
    summary:
      "Fenêtre à coins coupés, enfoncée dans la carte. Chaque ligne : puissance en bas puis en haut, en carte normale et en full art.",
  },
  {
    id: "haut-givre",
    title: "Titre en haut · verre givré",
    summary:
      "Encadrés en verre givré clair ; en full art, verre dépoli qui laisse deviner l'image. Chaque ligne : puissance en bas puis en haut, en carte normale et en full art.",
  },
  {
    id: "haut-parchemin",
    title: "Titre en haut · parchemin",
    summary:
      "Titre, type et texte sur parchemin ivoire, encre sombre ; en full art, parchemin translucide. Chaque ligne : puissance en bas puis en haut, en carte normale et en full art.",
  },
  {
    id: "haut-plaque",
    title: "Titre en haut · plaque gravée",
    summary:
      "Le titre dans la plaque de métal gravée du 44, au centre entre le mana et la puissance. Chaque ligne : puissance en bas puis en haut, en carte normale et en full art.",
  },
  {
    id: "haut-bandeau",
    title: "Titre en haut · bandeau",
    summary:
      "Le titre dans un bandeau qui occupe tout le haut de la carte, sous le mana et la puissance. Chaque ligne : puissance en bas puis en haut, en carte normale et en full art.",
  },
  {
    id: "haut-fin",
    title: "Titre en haut · cadre fin",
    summary:
      "Bordure fine (7 px), fenêtre arrondie avec une simple ombre légère : le plus épuré. Chaque ligne : puissance en bas puis en haut, en carte normale et en full art.",
  },
  {
    id: "final-bandeau",
    title: "Le 65 affiné",
    summary:
      "Le 65 (bandeau, puissance en bas) avec le cadre fin du 66 ; bandeau ajusté au cadre, description en italique sous l'effet, numéro et rareté en pied de carte, étoiles à partir de la légendaire.",
  },
  {
    id: "final-echancre",
    title: "Le 65 affiné · bandeau échancré",
    summary:
      "Le 67, avec le bandeau creusé en arc autour du mana : plus rien ne dépasse à gauche du mana.",
  },
  {
    id: "final-serti",
    title: "Le 65 affiné · mana serti",
    summary:
      "Le 67, avec le mana serti dans un anneau du métal de la bordure, qui recouvre le coin du bandeau.",
  },
  {
    id: "final-court",
    title: "Le 65 affiné · bandeau court",
    summary:
      "Le 67, avec un bandeau moins haut : le mana déborde en dessous, comme une pièce posée.",
  },
  {
    id: "final-sans-bandeau",
    title: "Le 65 affiné · sans bandeau",
    summary:
      "Le 67 sans bandeau : le titre est posé directement sur la carte, ou sur l'image en full art.",
  },
] as const;

export type DesignId = (typeof DESIGNS)[number]["id"];

export const DESIGN_IDS = DESIGNS.map((d) => d.id) as [DesignId, ...DesignId[]];

/**
 * Onglet « Design » : les propositions en cours (cinquième vague, le 65 affiné, `ui/v5.tsx`), en
 * carte normale et full art, puis quatre formes du bandeau autour du mana. Tout le reste est aux Archives.
 */
export const DESIGN_TAB: readonly DesignId[] = ["final-court"];

/** Onglet « Effets de rareté » : ce que chaque rareté ajoute, posé sur le design « Mix · Sculpté et verre fumé ». */
export const EFFECTS_TAB: readonly DesignId[] = [
  "effets-metaux",
  "effets-gemmes",
  "effets-lumiere",
  "effets-cosmique",
];

/**
 * Points de départ des propositions en cours, repliés sous l'onglet Design. Vide depuis la
 * cinquième vague : le 65 et le 66, comme tout le reste, sont aux Archives.
 */
export const REFERENCES: readonly DesignId[] = [];

/** Numéro affiché d'un design (sa place dans la liste, à partir de 1) : stable, on n'insère qu'à la fin. */
export function designNumber(id: DesignId): number {
  return DESIGN_IDS.indexOf(id) + 1;
}

/** Mots qui annulent un mot-clé placé juste après (« pas à supprimer », « rien à supprimer »…). */
const NEGATIONS = new Set(["pas", "ne", "n'", "rien", "jamais", "sans", "aucun", "aucune"]);
/** Nombre de mots lus avant un mot-clé pour y chercher une négation. */
const NEGATION_WINDOW = 4;

/** Vrai si un des mots qui précèdent le mot n° `index` (même membre de phrase) est une négation. */
function negated(words: string[], index: number): boolean {
  for (let i = index - 1; i >= Math.max(0, index - NEGATION_WINDOW); i--) {
    const word = words[i];
    if (word === undefined) break;
    // « mais » ouvre une nouvelle proposition : « pas mal mais à supprimer » compte.
    if (word === "mais") return false;
    if (NEGATIONS.has(word)) return true;
    // « plutôt qu'une variante », « plutôt que variant ».
    if (word === "plutot" && (words[i + 1] === "que" || words[i + 1] === "qu'")) return true;
  }
  return false;
}

/**
 * Mots-clés lus dans les commentaires des admins : « à supprimer » met le design à la corbeille,
 * « variant » le range dans les variantes à ressortir plus tard. Accents et majuscules ignorés ;
 * un mot-clé précédé d'une négation dans le même membre de phrase (« pas à supprimer », « rien à
 * supprimer », « plutôt qu'une variante ») ne compte pas.
 */
export function commentTags(comment: string | null): { remove: boolean; variant: boolean } {
  const text = (comment ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    // Une apostrophe termine un mot (« n'est » → « n' », « est ») pour reconnaître « n' » et « qu' ».
    .replace(/[’']/g, "' ");
  const tags = { remove: false, variant: false };
  // Membres de phrase : la négation d'un membre ne porte pas sur le suivant.
  for (const segment of text.split(/[.!?;:,\n]+/)) {
    const words = segment.split(/[^a-z0-9']+/).filter(Boolean);
    words.forEach((word, i) => {
      if (word === "a" && words[i + 1] === "supprimer" && !negated(words, i)) tags.remove = true;
      if (word.startsWith("variant") && !negated(words, i)) tags.variant = true;
    });
  }
  return tags;
}
