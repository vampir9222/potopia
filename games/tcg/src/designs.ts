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
] as const;

export type DesignId = (typeof DESIGNS)[number]["id"];

export const DESIGN_IDS = DESIGNS.map((d) => d.id) as [DesignId, ...DesignId[]];
