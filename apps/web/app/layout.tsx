import { BRAND } from "@app/config/brand";
import { Embers, JojoDecor, OnePieceDecor, resolveTheme, RgbFans, THEME_COOKIE } from "@app/ui";
import type { Metadata } from "next";
import { Anton, Cinzel, Orbitron, Pirata_One } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { Don } from "@/components/Don";
import { NextNavigation } from "@/components/NextNavigation";
import { ToBeContinued } from "@/components/ToBeContinued";
import { ZaWarudo } from "@/components/ZaWarudo";
import "./globals.css";

// Polices des titres, exposées aux thèmes (voir packages/ui/theme.css) : Cinzel pour Fantasy,
// Orbitron pour RGB, Anton pour JoJo, Pirata One pour One Piece.
const display = Cinzel({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display-face",
});
const gaming = Orbitron({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-gaming-face",
});
const jojo = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-jojo-face",
});
const onePiece = Pirata_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-onepiece-face",
});

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  icons: { icon: { url: BRAND.logo, type: "image/svg+xml" } },
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Thème choisi sur cet appareil (cookie posé par ThemeSwitcher), appliqué dès le rendu serveur.
  const theme = resolveTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html
      lang="fr"
      data-theme={theme}
      className={`${display.variable} ${gaming.variable} ${jojo.variable} ${onePiece.variable}`}
    >
      <body className="min-h-dvh antialiased">
        <Embers />
        <RgbFans />
        <JojoDecor />
        <OnePieceDecor />
        {/* liens des packages branchés sur Next : pas de rechargement entre deux pages */}
        <NextNavigation>{children}</NextNavigation>
        {/* défaite dans un jeu : arrêt sur image façon JoJo (toBeContinued() de @app/ui) */}
        <ToBeContinued />
        {/* passage au thème JoJo : arrêt du temps (zaWarudo() de @app/ui) */}
        <ZaWarudo />
        {/* passage au thème One Piece : « ドン!! » (don() de @app/ui) */}
        <Don />
      </body>
    </html>
  );
}
