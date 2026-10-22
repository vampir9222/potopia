import { BRAND } from "@app/config/brand";
import { Embers, resolveTheme, THEME_COOKIE } from "@app/ui";
import type { Metadata } from "next";
import { Cinzel } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import "./globals.css";

// Police des titres : exposée au thème via --font-display-face (voir packages/ui/theme.css).
const display = Cinzel({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display-face",
});

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Thème choisi sur cet appareil (cookie posé par ThemeSwitcher), appliqué dès le rendu serveur.
  const theme = resolveTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="fr" data-theme={theme} className={display.variable}>
      <body className="min-h-dvh antialiased">
        <Embers />
        {children}
      </body>
    </html>
  );
}
