# Agents Doubles — le jeu d'espions coopératif à deux

Adaptation des règles de **Codenames Duet** (jeu de Vlaada Chvátil, édité par Czech Games Edition),
avec notre propre nom et notre propre liste de mots.

Jeu intégré au portail : pages `/agents` (missions, invitation, classement) et `/agents/<id>` (une
partie), routes `/api/agents/*`, tuile dans le registre des apps.

## Règles

- **Grille** : 25 mots, communs aux deux joueurs.
- **Cartes secrètes** : chacun a la sienne, 9 agents et 3 assassins. Les deux cartes se recoupent
  comme la carte-clé recto verso du jeu (`PAIRS` dans `src/rules.ts`) : 3 agents communs, donc
  **15 agents à trouver** en tout.
- **Un tour** : un joueur donne un indice (un seul mot et un nombre de 0 à 9), l'autre touche des
  mots, jugés sur la carte de celui qui a donné l'indice :
  - agent : il continue (sans limite de nombre) ;
  - témoin : le tour s'arrête. Le mot n'est témoin que sur cette carte : il peut encore être un
    agent pour l'autre ;
  - assassin : mission perdue.
- Celui qui touche peut s'arrêter après au moins un mot. Le tour s'arrête aussi tout seul quand
  plus aucun agent ne reste sur la carte de celui qui a donné l'indice.
- **9 tours**, en alternant. Si un joueur n'a plus d'agents à faire trouver, l'autre donne tous les
  indices suivants.
- **Mort subite** après le 9e tour : plus d'indices, chacun touche quand il veut les agents de
  l'autre, et le moindre témoin ou assassin fait perdre. Un joueur qui a déjà trouvé tous les
  agents de son partenaire ne touche plus (il ne lui resterait que des témoins et des assassins) :
  il attend que l'autre finisse.
- Un indice ne peut pas être un mot encore visible de la grille, ni presque (pluriel, une ou deux
  lettres de plus).

## Dans le portail

- **Joueurs** : les membres du portail. On lance une mission en invitant un membre ; s'il y a déjà
  une mission en cours entre les deux, on y retourne au lieu d'en créer une autre. Une seule
  mission en cours par paire, garantie par la base (index unique partiel `games_running_pair_key`),
  même si les deux s'invitent au même instant.
- **Tour par tour** : chacun joue quand il veut. Une notification prévient quand c'est à l'autre
  (invitation, nouvel indice, tour qui lui revient, mort subite, fin). La page se met à jour toute
  seule toutes les 4 secondes quand on attend le partenaire, et dès qu'on revient sur l'onglet.
- **Salon** : `GET /api/agents/games` ne renvoie que mes parties (sans leurs indices ni leurs coups) ;
  `?partners=1` ajoute les membres à inviter, demandés au premier affichage seulement.
- **Classement des duos** : une ligne par paire de joueurs, du mois ou depuis le début. Classé sur
  la meilleure mission réussie (moins de tours, puis moins de témoins touchés), puis le nombre de
  victoires. Les abandons ne comptent pas.
- **Activité** : une mission terminée apparaît dans le fil (« a réussi une mission Agents Doubles
  avec X en 7 tours »).
- **Défaite** : une mission perdue sous les yeux du joueur (pas en rouvrant une partie déjà finie)
  déclenche l'arrêt sur image « To Be Continued » (`toBeContinued()` de `@app/ui`).
- **Données** : schéma Postgres `agents` (`games`, `clues`, `guesses`). `user_a` et `user_b`
  référencent `core.users` sans relation.

## Anti-triche

- La grille, les deux cartes et le premier joueur sont tirés **côté serveur** (aléatoire
  cryptographique).
- Chaque joueur ne reçoit que **sa** carte. Celle du partenaire n'est envoyée qu'une fois la partie
  finie.
- Chaque coup est un `POST /api/agents/games/<id>` : le serveur applique les règles (`src/rules.ts`)
  et enregistre. Un verrou optimiste (`version`) et la clé `(game_id, seq)` empêchent deux coups
  simultanés de passer tous les deux.
- Un membre qui n'est pas dans la partie ne peut ni la voir ni y jouer (403).

## Mots

- `data/words.json` : environ 1 700 mots. Des mots courants (nature, animaux, objets, métiers,
  lieux, sports, mots à double sens…) et des personnages ultra connus de jeux vidéo, films, séries
  et dessins animés (Mario, Sonic, Kratos, Dark Vador, Harry Potter…).
- Une grille ne met jamais côte à côte deux mots trop proches (« lapin » et « Lapins Crétins »).
- Pour ajouter des mots : les ajouter à `data/words.json` (le test vérifie qu'il n'y a pas de
  doublon, accents et majuscules ignorés).
