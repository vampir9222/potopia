import { BRAND } from "@app/config/brand";

const rtf = new Intl.RelativeTimeFormat(BRAND.locale, { numeric: "auto" });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

/** « il y a 5 minutes », « hier »… ; date complète au-delà d'une semaine. */
export function formatRelative(date: Date, now = new Date()): string {
  const diff = date.getTime() - now.getTime();
  if (Math.abs(diff) > 7 * 86_400_000) {
    return date.toLocaleDateString(BRAND.locale, { day: "numeric", month: "short" });
  }
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return "à l'instant";
}
