import {
  Anton,
  Bangers,
  Caveat,
  Cinzel,
  Comic_Neue,
  EB_Garamond,
  Lato,
  Libre_Franklin,
  Nunito,
  Press_Start_2P,
  Space_Grotesk,
  Spectral,
  VT323,
} from "next/font/google";

// Polices des propositions de design (games/tcg/ui), exposées en variables CSS : chargées
// seulement sur cette page. Seules celles de l'onglet Design (snap, magic, fantasyText, franklin,
// hand) sont préchargées ; les autres ne servent qu'aux anciens designs (archives) et se chargent
// quand une planche les utilise.
const pixel = Press_Start_2P({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-pixel",
  preload: false,
});
const pixelText = VT323({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-pixel-text",
  preload: false,
});
const comic = Bangers({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-comic",
  preload: false,
});
const comicText = Comic_Neue({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-comic-text",
  preload: false,
});
const fantasy = Cinzel({
  subsets: ["latin"],
  weight: ["600", "800"],
  variable: "--font-fantasy",
  preload: false,
});
const fantasyText = EB_Garamond({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-fantasy-text",
});
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk", preload: false });
const hand = Caveat({ subsets: ["latin"], variable: "--font-hand" });
const round = Nunito({ subsets: ["latin"], variable: "--font-round", preload: false });
// Designs premium : Snap, textes, Arcanes, Poké.
const snap = Anton({ subsets: ["latin"], weight: "400", variable: "--font-snap" });
const franklin = Libre_Franklin({ subsets: ["latin"], variable: "--font-franklin" });
const magic = Spectral({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-magic",
});
const poke = Lato({
  subsets: ["latin"],
  weight: ["700", "900"],
  style: ["normal", "italic"],
  variable: "--font-poke",
  preload: false,
});

export const designFonts = [
  pixel,
  pixelText,
  comic,
  comicText,
  fantasy,
  fantasyText,
  grotesk,
  hand,
  round,
  snap,
  franklin,
  magic,
  poke,
]
  .map((f) => f.variable)
  .join(" ");
