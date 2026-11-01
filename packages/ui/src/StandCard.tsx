// Stands célèbres : le membre en reçoit un, toujours le même (tiré de son identifiant).
const STANDS = [
  "Star Platinum",
  "The World",
  "Crazy Diamond",
  "Killer Queen",
  "Gold Experience",
  "Sticky Fingers",
  "King Crimson",
  "Stone Free",
  "Hermit Purple",
  "Magician's Red",
  "Hierophant Green",
  "Silver Chariot",
  "The Hand",
  "Heaven's Door",
  "Purple Haze",
  "Sex Pistols",
  "Aerosmith",
  "Made in Heaven",
  "Whitesnake",
  "Weather Report",
  "Soft & Wet",
  "Tusk",
];

// Les six capacités de la fiche, dans l'ordre de l'hexagone (en partant du haut).
const STATS = ["破壊力", "スピード", "射程距離", "持続力", "精密動作性", "成長性"] as const;
const STAT_LABELS = ["Puissance", "Vitesse", "Portée", "Endurance", "Précision", "Potentiel"];
const GRADES = ["E", "D", "C", "B", "A"] as const;

/** Nombre pseudo-aléatoire stable tiré d'un texte (même résultat côté serveur et client). */
function hash(text: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}

/** Sommet `i` (sur 6) d'un hexagone de rayon `r`, centré en (0, 0), pointe en haut. */
function vertex(i: number, r: number): [number, number] {
  const a = -Math.PI / 2 + (i * Math.PI) / 3;
  return [Math.cos(a) * r, Math.sin(a) * r];
}
const ring = (r: number) => STATS.map((_, i) => vertex(i, r).join(",")).join(" ");

type Props = {
  /** Identifiant du membre : choisit son Stand et ses notes, toujours les mêmes. */
  userId: string;
  name: string;
  image: string | null;
};

/**
 * Fiche de Stand du membre (thème JoJo), comme les fiches de l'anime : nom du Stand, « Manieur »,
 * avatar dans son aura, et l'hexagone des six capacités notées de A à E. Rendue pour tous les
 * thèmes mais affichée seulement par celui-ci (theme.css), où elle remplace la ligne du profil
 * dans le cadre du compte.
 */
export function StandCard({ userId, name, image }: Props) {
  const stand = STANDS[Math.floor(hash(userId, 1) * STANDS.length)] ?? STANDS[0];
  const grades = STATS.map((_, i) => Math.floor(hash(userId, 10 + i) * GRADES.length));
  const R = 62;
  const shape = grades.map((g, i) => vertex(i, (R * (g + 1)) / GRADES.length).join(",")).join(" ");
  const summary = STAT_LABELS.map((l, i) => `${l} ${GRADES[grades[i] ?? 0]}`).join(", ");

  return (
    <div
      className="jojo-stand"
      role="img"
      aria-label={`Stand : ${stand}, manieur ${name}. ${summary}.`}
    >
      <p className="jojo-stand-kind">「スタンド」</p>
      <p className="jojo-stand-name">{stand}</p>
      <div className="jojo-stand-user">
        <span className="jojo-stand-photo">
          {image ? <img src={image} alt="" /> : name.slice(0, 1).toUpperCase()}
        </span>
        <span className="jojo-stand-owner">
          <small>Manieur</small>
          {name}
        </span>
      </div>
      <svg className="jojo-stand-chart" viewBox="-112 -104 224 208" aria-hidden>
        {GRADES.map((_, g) => (
          <polygon
            key={g}
            points={ring((R * (g + 1)) / GRADES.length)}
            className="jojo-stand-ring"
          />
        ))}
        {STATS.map((_, i) => {
          const [x, y] = vertex(i, R);
          return <line key={i} x1={0} y1={0} x2={x} y2={y} className="jojo-stand-axis" />;
        })}
        <polygon points={shape} className="jojo-stand-shape" />
        {STATS.map((label, i) => {
          const [x, y] = vertex(i, R + 32);
          const [gx, gy] = vertex(i, R + 9);
          return (
            <g key={label}>
              <text x={x} y={y} className="jojo-stand-label">
                {label}
              </text>
              <text x={gx} y={gy} dy={4} className="jojo-stand-grade">
                {GRADES[grades[i] ?? 0]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
