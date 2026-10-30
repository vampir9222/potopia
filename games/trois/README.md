# TROIS — le Wordle français à 3 mots

_Jamais deux sans trois._

Chaque jour, **3 mots de 5 lettres** (toutes différentes), les mêmes pour tout le monde.
🟩 bonne lettre au bon endroit · 🟧 bonne lettre au mauvais endroit · ⬛ absente. 6 essais par mot,
les 3 mots se jouent dans l'ordre.

**Lettres répétées** : une lettre répétée dans l'essai est orange à chaque occurrence dès que la
réponse la contient (verte si elle est à sa place) ; les solutions n'ont jamais de lettre double,
donc deux fois la même lettre dans un essai ne peut jamais donner deux 🟩. Exemple : NONNE contre
NOIRS donne N vert, O vert, N orange, N orange, E noir.

Jeu intégré au portail : page `/trois`, routes `/api/trois/*`, tuile dans le registre des apps.

## Dans le portail

- **Joueurs** : les membres connectés avec Discord (nom et avatar du portail). Pas de compte propre
  au jeu : la partie suit le compte Discord sur tous les appareils.
- **Classement** : jour, semaine (depuis lundi) ou mois, avec tous les joueurs (couleurs uniquement)
  et un podium. Pour la semaine et le mois, un mot trouvé rapporte 6 points en 1 essai, puis un de
  moins par essai, jusqu'à 1 point en 6 essais.
- **Historique du classement** : les flèches ‹ › sous Jour / Semaine / Mois remontent aux jours,
  semaines et mois passés, jusqu'au premier jour où quelqu'un a joué
  (`GET /api/trois/leaderboard?period=…&date=AAAA-MM-JJ` : le jour, ou la période qui contient ce
  jour ; une date future retombe sur aujourd'hui). Toujours les couleurs seulement, jamais les
  lettres ni les réponses. La période en cours se rafraîchit toute seule, l'historique est figé.

## Passage à minuit

Les mots changent à minuit, heure de Paris. Pour qu'une partie en cours ne soit pas perdue :

- **Alerte** : dès 23h45, un bandeau au-dessus de la grille affiche le temps qui reste (« Plus que
  12:34 pour jouer », ou, pour une journée commencée, « Nouveaux mots dans 12:34 · tu auras
  jusqu'à 00h30 pour finir celle-ci »).
- **Délai de grâce** (`GRACE_MINUTES` = 30, `src/game.ts`) : une journée commencée avant minuit (au
  moins un essai) et pas finie reste jouable jusqu'à 00h30. Après minuit, le bandeau compte jusqu'à
  00h30 et propose « Passer aux nouveaux mots » ; à 00h30, le jeu charge les nouveaux mots. Une
  journée finie pendant le délai compte pour la veille (classement, série, activité), et son écran
  de fin reste affiché avec un bouton « Jouer les nouveaux mots ».
- **Côté serveur** : chaque essai envoie la journée jouée (`date` dans `POST /api/trois/guess`). Le
  serveur accepte la sienne, ou celle d'hier seulement pendant le délai, si elle était commencée,
  pas finie, et si la nouvelle n'est pas commencée (commencer la nouvelle, c'est laisser tomber
  l'ancienne). Sinon 409 et le client recharge : un essai pensé pour hier n'est jamais compté pour
  aujourd'hui. `GET /api/trois/game` renvoie la journée d'hier tant qu'elle est dans son délai,
  sauf avec `?today=1` (« Passer aux nouveaux mots »). Chaque journée porte `endsAt`, le minuit qui
  la termine (heure d'été comprise).
- **Activité** : une journée terminée apparaît dans le fil du portail (« a fini TROIS #42 : 2/3 »),
  avec le score seulement, jamais les lettres.
- **Données** : schéma Postgres `trois` (`games`, `guesses`, `daily_words`), `user_id` référence
  `core.users` sans relation.

## Anti-triche

- Les mots du jour sont tirés au hasard (aléatoire cryptographique) **côté serveur** et stockés en
  base (`daily_words`) : impossible de les prédire, même avec le code source.
- Chaque essai est un `POST /api/trois/guess` : le serveur vérifie que le mot existe, le compare à la
  réponse et renvoie le feedback lettre par lettre. Le client ne calcule rien et n'a **aucune liste
  de mots** dans son bundle.
- La réponse d'un mot n'est renvoyée qu'une fois ce mot terminé. Le classement ne montre que les
  couleurs des autres, jamais les lettres.
- La date du jour est toujours celle du serveur (heure de Paris) : le client dit quelle journée il
  joue, mais seul le serveur décide si elle est encore jouable (délai de grâce compris). La
  contrainte unique `(game_id, attempt)` empêche d'enregistrer deux fois le même essai.
- **Mode test** : un mot déjà terminé peut être rejoué « pour de faux » (`POST /api/trois/practice`).
  Le serveur évalue l'essai mais n'écrit rien, et refuse un mot pas encore terminé.

## Sons, animations et mode secret

- Victoire : les cases sautent et des confettis tombent (désactivé si l'appareil demande moins
  d'animations). Pour un 3 sur 3, grosse pluie de confettis et fanfare.
- Sons synthétisés avec Web Audio (`ui/sound.ts`), sans fichier audio. Bouton 🔊/🔇 mémorisé sur
  l'appareil. Le bouton volume du portail (header) s'applique par-dessus : il règle ou coupe les
  sons du jeu même quand le 🔊 du jeu est actif, et un jeu en 🔇 reste muet quel que soit le volume
  du portail.
- 🤫 Un mode secret se déclenche en tapant un mot caché. Purement visuel et sonore : rien n'est
  envoyé au serveur.

## Mots

- `data/solutions.json` : 759 mots courants (noms, adjectifs, infinitifs) de 5 lettres sans lettre
  répétée, tirés de [Lexique 3.83](http://www.lexique.org) et triés à la main.
- **Aucune répétition pendant 253 jours** (759 ÷ 3) : chaque tirage est enregistré et on ne pioche
  que parmi les mots jamais sortis. Une fois la liste épuisée, on pioche dans la moitié sortie il y a
  le plus longtemps. Pour repousser l'échéance, ajouter des mots à `data/solutions.json`.
- `data/valid.json` : environ 5 000 mots acceptés comme essais (toutes formes fléchies). Les accents
  sont ignorés (`é` → `e`).
