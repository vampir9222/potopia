// Noms de Stand en jeu de mots sur le pseudo, calqués sur de vrais Stands ; le membre en reçoit
// toujours le même (tiré de son identifiant).
const PUNS: ((n: string) => string)[] = [
  (n) => `${n} Experience`, // Gold Experience
  (n) => `Crazy ${n}`, // Crazy Diamond
  (n) => `Killer ${n}`, // Killer Queen
  (n) => `${n} Platinum`, // Star Platinum
  (n) => `The ${n}`, // The World
  (n) => `Silver ${n}`, // Silver Chariot
  (n) => `Sticky ${n}`, // Sticky Fingers
  (n) => `King ${n}`, // King Crimson
  (n) => `${n} Free`, // Stone Free
  (n) => `Hierophant ${n}`, // Hierophant Green
  (n) => `Purple ${n}`, // Purple Haze
  (n) => `${n} in Heaven`, // Made in Heaven
];

// Les six capacités, dans l'ordre de l'hexagone (en partant du haut).
const STATS = ["破壊力", "スピード", "射程距離", "持続力", "精密動作性", "成長性"] as const;
const STAT_LABELS = ["Puissance", "Vitesse", "Portée", "Endurance", "Précision", "Potentiel"];
const GRADES = ["E", "D", "C", "B", "A"] as const;

/** Les vraies données du membre dont viennent les notes. */
export type StandStats = {
  /** Puissance : solde de Potocoins. */
  balance: number;
  /** Vitesse : essais moyens par mot trouvé à TROIS (null sans mot trouvé). */
  avgTries: number | null;
  /** Portée : parties d'Agents Doubles. */
  agentsGames: number;
  /** Endurance : plus longue série de journées TROIS terminées. */
  maxStreak: number;
  /** Précision : journées TROIS parfaites (tous les mots trouvés). */
  perfectDays: number;
  /** Potentiel : émeraudes du Chaos trouvées (sur 7). */
  emeralds: number;
};

/** Note de 0 (E) à 4 (A) : le nombre de seuils atteints (seuils de D à A, croissants). */
const grade = (value: number, thresholds: [number, number, number, number]) =>
  thresholds.filter((t) => value >= t).length;

function grades(s: StandStats): number[] {
  return [
    grade(s.balance, [50, 200, 500, 1000]),
    // moins d'essais = plus rapide : on note l'inverse (6 essais au plus)
    s.avgTries === null ? 0 : grade(6 - s.avgTries, [1.5, 2.5, 3, 3.5]),
    grade(s.agentsGames, [2, 6, 15, 30]),
    grade(s.maxStreak, [3, 7, 14, 30]),
    grade(s.perfectDays, [1, 4, 10, 20]),
    grade(s.emeralds, [1, 3, 5, 7]),
  ];
}

/** Nombre pseudo-aléatoire stable tiré d'un texte (même résultat côté serveur et client). */
function hash(text: string): number {
  let h = 2166136261;
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
  /** Identifiant du membre : choisit la forme du nom de son Stand, toujours la même. */
  userId: string;
  name: string;
  image: string | null;
  stats: StandStats;
};

/**
 * Fiche de Stand du membre (thème JoJo), comme les fiches de l'anime : nom du Stand (jeu de mots
 * sur son pseudo, « Requiem » avec les 7 émeraudes), « Manieur », avatar dans son aura, et
 * l'hexagone des six capacités notées de A à E d'après ses vraies données. Un clic l'invoque :
 * Star Platinum flotte alors autour de la souris (`JojoFx` de l'app). Rendue pour tous les thèmes
 * mais affichée seulement par celui-ci (theme.css), où elle remplace la ligne du profil.
 */
export function StandCard({ userId, name, image, stats }: Props) {
  const first = name.trim().split(/\s+/)[0] || name;
  const pun = PUNS[Math.floor(hash(userId) * PUNS.length)] ?? PUNS[0];
  const stand = `${pun?.(first) ?? first}${stats.emeralds >= 7 ? " Requiem" : ""}`;
  const notes = grades(stats);
  const R = 62;
  const shape = notes.map((g, i) => vertex(i, (R * (g + 1)) / GRADES.length).join(",")).join(" ");
  const summary = STAT_LABELS.map((l, i) => `${l} ${GRADES[notes[i] ?? 0]}`).join(", ");

  return (
    <button
      type="button"
      className="jojo-stand"
      data-stand-toggle
      aria-label={`Stand : ${stand}, manieur ${name}. ${summary}. Invoquer ou rappeler le Stand.`}
    >
      <span className="jojo-stand-kind">「スタンド」</span>
      <span className="jojo-stand-name">{stand}</span>
      <span className="jojo-stand-user">
        <span className="jojo-stand-photo">
          {image ? <img src={image} alt="" /> : name.slice(0, 1).toUpperCase()}
        </span>
        <span className="jojo-stand-owner">
          <small>Manieur</small>
          {name}
        </span>
      </span>
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
                {GRADES[notes[i] ?? 0]}
              </text>
            </g>
          );
        })}
      </svg>
      <span className="jojo-stand-call">
        <span className="jojo-stand-call-off">Clic : invoquer ton Stand</span>
        <span className="jojo-stand-call-on">Stand invoqué · clic : le rappeler</span>
      </span>
    </button>
  );
}
