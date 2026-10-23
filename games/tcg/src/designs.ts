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
] as const;

export type DesignId = (typeof DESIGNS)[number]["id"];

export const DESIGN_IDS = DESIGNS.map((d) => d.id) as [DesignId, ...DesignId[]];
