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
// seulement sur cette page.
const pixel = Press_Start_2P({ subsets: ["latin"], weight: "400", variable: "--font-pixel" });
const pixelText = VT323({ subsets: ["latin"], weight: "400", variable: "--font-pixel-text" });
const comic = Bangers({ subsets: ["latin"], weight: "400", variable: "--font-comic" });
const comicText = Comic_Neue({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-comic-text",
});
const fantasy = Cinzel({ subsets: ["latin"], weight: ["600", "800"], variable: "--font-fantasy" });
const fantasyText = EB_Garamond({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-fantasy-text",
});
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk" });
const hand = Caveat({ subsets: ["latin"], variable: "--font-hand" });
const round = Nunito({ subsets: ["latin"], variable: "--font-round" });
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
