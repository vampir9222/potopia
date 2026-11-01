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
  (n) => `Magician's ${n}`, // Magician's Red
  (n) => `Hermit ${n}`, // Hermit Purple
  (n) => `${n}'s Door`, // Heaven's Door
  (n) => `${n} Act 3`, // Echoes Act 3
  (n) => `${n} Pistols`, // Sex Pistols
  (n) => `${n}smith`, // Aerosmith
  (n) => `Moody ${n}`, // Moody Blues
  (n) => `Weather ${n}`, // Weather Report
  (n) => `${n}snake`, // Whitesnake
  (n) => `C-${n}`, // C-Moon
  (n) => `${n} & Wet`, // Soft & Wet
  (n) => `${n} Act 4`, // Tusk Act 4
  (n) => `Dirty Deeds Done ${n}`, // D4C
  (n) => `Spice ${n}`, // Spice Girl
  (n) => `Black ${n}`, // Black Sabbath
  (n) => `Beach ${n}`, // Beach Boy
  (n) => `Green ${n}`, // Green Day
  (n) => `${n} Hand`, // The Hand
  (n) => `Pearl ${n}`, // Pearl Jam
  (n) => `Highway ${n}`, // Highway Star
  (n) => `Red Hot ${n} Pepper`, // Red Hot Chili Pepper
  (n) => `${n} Bites the Dust`, // Killer Queen : Bites the Dust
  (n) => `Stray ${n}`, // Stray Cat
  (n) => `Love ${n}`, // Love Train
  (n) => `Wonder of ${n}`, // Wonder of U
  (n) => `Paisley ${n}`, // Paisley Park
  (n) => `Cheap ${n}`, // Cheap Trick
  (n) => `Super ${n}`, // Super Fly
  (n) => `${n} Heart Father`, // Atom Heart Father
  (n) => `${n} Diver`, // Diver Down
];

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

type Thresholds = [d: number, c: number, b: number, a: number];
/** Note de 0 (E) à 4 (A) : le nombre de seuils atteints (seuils de D à A, croissants). */
const grade = (value: number, t: Thresholds) => t.filter((x) => value >= x).length;

/*
 * Les six capacités des fiches de l'anime, dans l'ordre de l'hexagone (en partant du haut) : d'où
 * vient chaque note, et l'explication montrée quand on clique dessus (bulle, `JojoFx` de l'app).
 */
const STATS: { label: string; help: string; grade: (s: StandStats) => number }[] = [
  {
    label: "Puissance",
    help: "Ton solde de Potocoins. D dès 50, C dès 200, B dès 500, A dès 1 000.",
    grade: (s) => grade(s.balance, [50, 200, 500, 1000]),
  },
  {
    label: "Vitesse",
    help: "À TROIS, tes essais moyens pour trouver un mot : moins il t'en faut, plus tu es rapide. D sous 4,5 essais, C sous 3,5, B sous 3, A sous 2,5.",
    // moins d'essais = plus rapide : on note l'inverse (6 essais au plus)
    grade: (s) => (s.avgTries === null ? 0 : grade(6 - s.avgTries, [1.5, 2.5, 3, 3.5])),
  },
  {
    label: "Portée",
    help: "Tes parties d'Agents Doubles. D dès 2, C dès 6, B dès 15, A dès 30.",
    grade: (s) => grade(s.agentsGames, [2, 6, 15, 30]),
  },
  {
    label: "Endurance",
    help: "Ta plus longue série de journées TROIS terminées. D dès 3 jours, C dès 7, B dès 14, A dès 30.",
    grade: (s) => grade(s.maxStreak, [3, 7, 14, 30]),
  },
  {
    label: "Précision",
    help: "Tes journées TROIS parfaites, tous les mots trouvés. D dès 1, C dès 4, B dès 10, A dès 20.",
    grade: (s) => grade(s.perfectDays, [1, 4, 10, 20]),
  },
  {
    label: "Potentiel",
    help: "Les émeraudes du Chaos que tu as trouvées. D dès 1, C dès 3, B dès 5, A avec les 7 : ton Stand passe alors en Requiem.",
    grade: (s) => grade(s.emeralds, [1, 3, 5, 7]),
  },
];
const GRADES = ["E", "D", "C", "B", "A"] as const;

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
 * l'hexagone des six capacités notées de A à E d'après ses vraies données (un clic sur une
 * capacité l'explique). Le bouton « STAND » l'invoque : Star Platinum flotte alors autour de la
 * souris (`JojoFx` de l'app). Rendue pour tous les thèmes mais affichée seulement par celui-ci
 * (theme.css), où elle remplace la ligne du profil.
 */
export function StandCard({ userId, name, image, stats }: Props) {
  const first = name.trim().split(/\s+/)[0] || name;
  const pun = PUNS[Math.floor(hash(userId) * PUNS.length)] ?? PUNS[0];
  const stand = `${pun?.(first) ?? first}${stats.emeralds >= 7 ? " Requiem" : ""}`;
  const notes = STATS.map((s) => s.grade(stats));
  const R = 62;
  const shape = notes.map((g, i) => vertex(i, (R * (g + 1)) / GRADES.length).join(",")).join(" ");
  const summary = STATS.map((s, i) => `${s.label} ${GRADES[notes[i] ?? 0]}`).join(", ");

  return (
    <div className="jojo-stand">
      <span className="sr-only">{`Stand : ${stand}, manieur ${name}. ${summary}.`}</span>
      <button type="button" className="jojo-stand-toggle" data-stand-toggle aria-pressed="false">
        STAND
      </button>
      <span className="jojo-stand-name" aria-hidden>
        {stand}
      </span>
      <span className="jojo-stand-user" aria-hidden>
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
        {STATS.map((stat, i) => {
          const [x, y] = vertex(i, R + 32);
          const [gx, gy] = vertex(i, R + 9);
          return (
            <g key={stat.label} className="jojo-stand-stat" data-stand-help={stat.help}>
              <text x={x} y={y} className="jojo-stand-label">
                {stat.label}
              </text>
              <text x={gx} y={gy} dy={4} className="jojo-stand-grade">
                {GRADES[notes[i] ?? 0]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
