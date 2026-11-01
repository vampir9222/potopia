// La hiérarchie du Palais intérieur (後宮), du bas en haut : Mao Mao y entre comme servante.
// Points = poisons goûtés (mots trouvés à TROIS) + remèdes préparés (parties d'Agents Doubles).
const RANKS = [
  { from: 0, title: "下女", label: "Servante" },
  { from: 10, title: "侍女", label: "Dame de compagnie" },
  { from: 30, title: "女官", label: "Dame du palais" },
  { from: 75, title: "中級妃", label: "Concubine de rang moyen" },
  { from: 150, title: "上級妃", label: "Concubine de haut rang" },
] as const;

/** Les vraies données du membre dont vient son rang. */
export type PalaceStats = {
  /** Mots trouvés à TROIS : « poisons goûtés ». */
  wordsFound: number;
  /** Parties d'Agents Doubles : « remèdes préparés ». */
  agentsGames: number;
  /** Solde : « taels d'argent ». */
  balance: number;
};

type Props = { name: string; image: string | null; stats: PalaceStats };

/**
 * Registre du Palais intérieur (thème Apothicaire) : le membre y est inscrit à son rang du palais,
 * de servante à concubine de haut rang selon ses poisons goûtés (mots trouvés à TROIS) et ses
 * remèdes préparés (parties d'Agents Doubles), avec la barre jusqu'au rang suivant et le sceau
 * vermillon de son nom. Rendu pour tous les thèmes mais affiché seulement par celui-ci
 * (theme.css), où il remplace la ligne du profil et le solde.
 */
export function PalaceRecord({ name, image, stats }: Props) {
  const points = stats.wordsFound + stats.agentsGames;
  const index = RANKS.filter((r) => points >= r.from).length - 1;
  const rank = RANKS[index] ?? RANKS[0];
  const next = RANKS[index + 1];
  const progress = next ? (points - rank.from) / (next.from - rank.from) : 1;
  const seal = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div
      className="apo-record"
      role="img"
      aria-label={`Registre du Palais intérieur : ${name}, ${rank.label}. ${stats.wordsFound} poisons goûtés, ${stats.agentsGames} remèdes préparés, ${stats.balance} taels.`}
    >
      <p className="apo-record-head">
        <span lang="zh">後宮</span> Registre du Palais
      </p>
      <div className="apo-record-body">
        <span className="apo-record-photo">{image ? <img src={image} alt="" /> : seal}</span>
        <span className="apo-record-who">
          <span className="apo-record-rank">
            <span lang="zh">{rank.title}</span> {rank.label}
          </span>
          <span className="apo-record-name">{name}</span>
        </span>
        <span className="apo-record-seal">{seal}</span>
      </div>
      <dl className="apo-record-stats">
        <div title="Poisons goûtés : mots trouvés à TROIS">
          <dt>Poisons</dt>
          <dd>{stats.wordsFound}</dd>
        </div>
        <div title="Remèdes préparés : parties d'Agents Doubles">
          <dt>Remèdes</dt>
          <dd>{stats.agentsGames}</dd>
        </div>
        <div title="Taels d'argent : ton solde">
          <dt>Taels</dt>
          <dd>{stats.balance}</dd>
        </div>
      </dl>
      <div className="apo-record-next">
        <span className="apo-record-bar">
          <span style={{ width: `${Math.round(progress * 100)}%` }} />
        </span>
        <span className="apo-record-goal">
          {next
            ? `Encore ${next.from - points} pour devenir ${next.label.toLowerCase()}`
            : "Le sommet du Palais intérieur"}
        </span>
      </div>
    </div>
  );
}
