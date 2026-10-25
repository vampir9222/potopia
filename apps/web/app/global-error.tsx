"use client";

import { BRAND } from "@app/config/brand";
import Link from "next/link";
import { useEffect, type CSSProperties } from "react";

// Ce fichier remplace le layout racine quand celui-ci plante : il rend son propre <html> et ne
// reçoit ni globals.css ni les thèmes. Les styles sont donc en ligne, dans les tons du thème par
// défaut (voir packages/ui/theme.css).
const colors = {
  bg: "#0f0b12",
  surface: "#19131d",
  text: "#f1e8d8",
  muted: "#a8998b",
  accent: "#e6b04e",
};

const styles = {
  body: {
    margin: 0,
    minHeight: "100dvh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    background: colors.bg,
    color: colors.text,
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
    textAlign: "center",
  },
  title: { margin: 0, fontSize: 18, fontWeight: 600 },
  text: { margin: 0, maxWidth: 400, fontSize: 14, color: colors.muted },
  actions: { display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 8 },
  button: {
    height: 40,
    padding: "0 16px",
    borderRadius: 6,
    border: 0,
    background: colors.accent,
    color: colors.bg,
    font: "600 14px ui-sans-serif, system-ui, sans-serif",
    cursor: "pointer",
  },
  link: {
    display: "inline-flex",
    alignItems: "center",
    height: 40,
    padding: "0 16px",
    borderRadius: 6,
    border: `1px solid ${colors.accent}`,
    background: colors.surface,
    color: colors.text,
    font: "600 14px ui-sans-serif, system-ui, sans-serif",
    textDecoration: "none",
  },
} satisfies Record<string, CSSProperties>;

/** Erreur dans le layout racine lui-même : page minimale, sans détail technique. */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="fr">
      <head>
        <title>{`Erreur · ${BRAND.name}`}</title>
      </head>
      <body style={styles.body}>
        <main style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <h1 style={styles.title}>Quelque chose s'est mal passé</h1>
          <p style={styles.text}>
            {BRAND.name} n'a pas pu afficher la page. Réessaie dans un instant ; si ça continue,
            préviens un admin.
          </p>
          <div style={styles.actions}>
            <button type="button" onClick={() => retry()} style={styles.button}>
              Réessayer
            </button>
            <Link href="/" style={styles.link}>
              Accueil
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
