import { AGENTS_TOTAL, TURNS } from "../src/game";

/** Règles en bref (celles de Codenames Duet). */
export function Rules() {
  return (
    <div className="text-muted flex flex-col gap-2 text-sm">
      <p>
        Jeu <strong className="text-text">coopératif à deux</strong> : vous gagnez ou perdez
        ensemble. La grille de 25 mots est commune, mais chacun a sa carte secrète : 9 agents (bande
        verte) et 3 assassins 💀. Il y a {AGENTS_TOTAL} agents à trouver en tout.
      </p>
      <ul className="list-disc space-y-1 pl-4">
        <li>
          À ton tour, donne <strong className="text-text">un seul mot</strong> et un nombre, pour
          faire trouver tes agents à ton partenaire. Pas un mot de la grille !
        </li>
        <li>
          Il touche les mots un par un. Agent : il continue. Témoin : le tour s'arrête. Assassin :
          mission perdue.
        </li>
        <li>
          Un témoin ne l'est que sur la carte de celui qui a donné l'indice : ce mot peut encore
          être un agent pour l'autre.
        </li>
        <li>
          Vous avez {TURNS} tours, en alternant. Ensuite, mort subite : plus d'indices, et la
          moindre erreur fait perdre.
        </li>
      </ul>
      <p>
        Classement des duos : la mission réussie en le moins de tours, puis avec le moins de
        témoins.
      </p>
    </div>
  );
}
