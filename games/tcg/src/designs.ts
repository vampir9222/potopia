/**
 * Propositions de design de carte, notées par les admins. L'identifiant est stocké avec chaque
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
] as const;

export type DesignId = (typeof DESIGNS)[number]["id"];

export const DESIGN_IDS = DESIGNS.map((d) => d.id) as [DesignId, ...DesignId[]];

/** Onglet « Design » : les propositions en cours (mélange de 39 et 44), cartes normales et full art. */
export const DESIGN_TAB: readonly DesignId[] = ["mix-verre", "mix-serti", "mix-plaque"];

/** Onglet « Effets de rareté » : ce que chaque rareté ajoute, posé sur le design « Mix · Sculpté et verre fumé ». */
export const EFFECTS_TAB: readonly DesignId[] = [
  "effets-metaux",
  "effets-gemmes",
  "effets-lumiere",
  "effets-cosmique",
];

/** Designs retenus comme point de départ du mélange (39 et 44), toujours visibles dans l'onglet Design. */
export const REFERENCES: readonly DesignId[] = ["arcanes-v2", "raretes-v3"];

/** Numéro affiché d'un design (sa place dans la liste, à partir de 1) : stable, on n'insère qu'à la fin. */
export function designNumber(id: DesignId): number {
  return DESIGN_IDS.indexOf(id) + 1;
}

/**
 * Mots-clés lus dans les commentaires des admins : « à supprimer » met le design à la corbeille,
 * « variant » le range dans les variantes à ressortir plus tard. Accents et majuscules ignorés.
 */
export function commentTags(comment: string | null): { remove: boolean; variant: boolean } {
  const text = (comment ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return { remove: /\ba supprimer\b/.test(text), variant: /\bvariant/.test(text) };
}
