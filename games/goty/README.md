# GOTY Party dans Potopia

Les lots 2 à 6 livrent `@app/goty` : éditions, préparation, pronostics, cérémonie, archives,
interface React et écran TV. La tuile membre ouvre `/goty` ; `/admin/goty` permet aux admins
de créer les éditions. Les notifications internes et le guide d’exploitation sont intégrés ;
la recette finale et la mise en service restent au lot 7.

- [Plan des lots](../../docs/PLAN_INTEGRATION_GOTY_PARTY.md)
- [Contrat fonctionnel et recette](../../docs/CONTRAT_FONCTIONNEL_GOTY_PARTY.md)
- [Installation, sauvegardes, médias et diagnostic](../../docs/EXPLOITATION_GOTY_PARTY.md)

## Données

Migration additive `20261031230000_goty`, sans transfert depuis goty-party et sans modification
des données des autres domaines. Le schéma PostgreSQL `goty` contient huit tables métier :

| Table         | Rôle                                                                             |
| ------------- | -------------------------------------------------------------------------------- |
| `editions`    | Année unique, nom, phase, version, état de présentation                          |
| `members`     | Inscription et rôles par édition ; couple édition/utilisateur unique             |
| `rounds`      | Top et catégories, position et nom normalisé uniques par édition, état et tirage |
| `games`       | Jeux d’un participant, métadonnées de catalogue et trailer facultatifs           |
| `choices`     | Un choix par rubrique et participant, précision et musique                       |
| `predictions` | Un pronostic par rubrique, auteur et cible                                       |
| `proposals`   | Propositions avec nom normalisé unique par édition                               |
| `votes`       | Un vote favorable par proposition et participant                                 |

La migration additive `20261101010000_goty_catalog` ajoute `catalog_cache` (résultats publics
IGDB et expiration) et `catalog_quotas` (compteurs partagés), sans modifier de table existante.

Phases : `categories`, `preparation`, `live`, `closed`. Les transitions de préparation, soirée,
retour en préparation et clôture sont disponibles. Statuts de rubrique : `draft`, `announced`, `locked`,
`revealing`, `done`. Les tableaux de révélation contiennent des identifiants de type chaîne.

Les FK restent internes à GOTY. Les identités sont obtenues via les services de `core` et aucun
compte ou session GOTY n’est créé. Les services de choix et pronostics vérifient édition, rubrique,
propriétaire du jeu et cible. Les FK seules ne remplacent
pas ces contrôles métier. Les suppressions de jeux référencés sont restreintes.
Le conducteur utilise une contrainte unique de position : son réordonnancement passe par des
positions temporaires dans une transaction pour éviter les collisions. Le lot 4 ne nécessite
aucune migration supplémentaire.

## API serveur disponible

Toutes les fonctions proviennent de `@app/goty`, à l’exception des règles pures exportées par
`@app/goty/rules`. L’appelant doit d’abord vérifier la session avec `requireMember` ou les
helpers de `apps/web`, puis fournir son identifiant applicatif comme `actorId`. Ce champ ne
doit jamais être recopié depuis une entrée du navigateur.

Les droits d’admin sont relus via `core.isAdmin`, sans faire confiance au rôle stocké en base.
Les services de données acceptent `opts?: { tx?: DbTx }` ; les écritures rejoignent la transaction
fournie ou en ouvrent une nouvelle. Une erreur doit être propagée pour annuler cette transaction.

| Fonction              | Entrée                                             | Résultat                                                                   |
| --------------------- | -------------------------------------------------- | -------------------------------------------------------------------------- |
| `createEdition`       | `{ actorId, year, name }`                          | `{ id, version: 1 }`                                                       |
| `listEditions`        | `actorId`                                          | Résumés accessibles, année décroissante                                    |
| `getEdition`          | `{ actorId, editionId }`                           | Résumé avec version et permissions calculées                               |
| `listEditionMembers`  | `{ actorId, editionId }`                           | Identifiant, nom, image et rôles des inscrits                              |
| `listEligibleMembers` | `{ actorId, editionId }`                           | Identifiant, nom et image des utilisateurs connus ; organisation seulement |
| `setEditionMembers`   | `{ actorId, editionId, expectedVersion, members }` | `{ ok: true, version }`                                                    |

`members` contient `{ userId, organizer, presenter }`. Une édition est créée par un admin ou un
organisateur déjà désigné ; son auteur est inscrit comme organisateur et présentateur, avec
14 rubriques initiales. La liste des inscriptions ne peut être vide ou dupliquée. Tous les
utilisateurs doivent être connus de `core`.

Seul un admin peut changer les organisateurs. L’organisateur peut changer les présentateurs,
ajouter des participants avant la soirée et en retirer en phase Catégories s’ils n’ont pas de
jeux. Le retrait supprime leurs propositions et votes uniquement dans cette édition. Les rôles
restent modifiables pendant la soirée ; une archive est en lecture seule. Les membres hors
édition ne peuvent consulter que les archives ; les admins peuvent consulter toutes les éditions.

Les remplacements d’inscriptions prennent un verrou de ligne sur l’édition, vérifient la version
attendue et l’incrémentent. Les lectures d’accès prennent un verrou partagé sur cette ligne
pour garder les inscriptions et la version cohérentes face aux écritures concurrentes.

`getEdition` est volontairement une vue limitée du socle : aucun écran brut, choix ou pronostic.
`listEditionMembers` fournit uniquement les identités et rôles. Les compteurs de préparation,
le `MemberSnapshot` complet et la projection TV sont disponibles via les services du lot 4.

`GotyError` expose `code`, `message` et `status` : `INVALID_INPUT` (400), `FORBIDDEN` (403),
`NOT_FOUND` (404), `CONFLICT` (409), `RATE_LIMITED` (429), `CATALOG_UNAVAILABLE` (503).
Les erreurs ne contiennent pas les entrées privées.

## Services de préparation (lot 3)

| Fonction          | Entrée en plus de `actorId`, `editionId`                | Résultat                                                     |
| ----------------- | ------------------------------------------------------- | ------------------------------------------------------------ |
| `proposeCategory` | `name`                                                  | `{ id, version }`, participant en Catégories                 |
| `voteCategory`    | `proposalId`, `favor`                                   | `{ ok, version }`, vote favorable ou retrait                 |
| `prepareEdition`  | `expectedVersion`                                       | `{ ok, version }`, organisation ; adoption à 75 %            |
| `addCategory`     | `name`                                                  | `{ id, version }`, organisation en Préparation               |
| `listCategories`  | Aucun                                                   | Rubriques sans tirage et propositions avec total et son vote |
| `addGames`        | `games: GameInput[]`                                    | `{ ok, count, version }`, ajout ou import atomique           |
| `updateGame`      | `gameId`, `game: GameInput` complet                     | `{ ok, version }`                                            |
| `deleteGame`      | `gameId`                                                | `{ ok, version }`, refus si référencé                        |
| `listGames`       | Aucun                                                   | Listes partagées de l’édition, sans choix                    |
| `setChoice`       | `roundId`, `gameId` ou `null`, `precision?`, `youtube?` | `{ ok, version }`, uniquement son choix                      |
| `listOwnChoices`  | Aucun                                                   | Choix de l’acteur seulement, même pour un admin              |

Ces écritures verrouillent la ligne d’édition et incrémentent sa version. Les listes sont
modifiables en Catégories et Préparation ; les choix à partir de la Préparation, tant que leur
rubrique est `draft`. Une archive est immuable. Les noms sont comparés sans accents, casse,
espaces multiples ou différence d’apostrophe. Les propositions ne votent pas automatiquement
pour leur auteur. Les nouvelles arrivées en Préparation ne recalculent pas les prix adoptés.

`GameInput` : titre obligatoire (200 caractères), plateforme/période (100), Terminé/Platine
facultatifs, référence IGDB, jaquette HTTPS sur `images.igdb.com`, identifiant YouTube de trailer
facultatifs. Un lot contient 1 à 1000 jeux ; les doublons sont conservés, une erreur invalide
tout le lot. Un jeu ne peut apparaître qu’une fois dans le top, mais peut recevoir plusieurs prix.
Les trous temporaires du top restent possibles pendant l’édition ; chaque annonce de rubrique
du top exige un classement contigu depuis la place 1. La précision est limitée à 500 caractères. YouTube est réservé à la bande-son,
validé et normalisé. Modifier son choix ne supprime aucun pronostic déjà enregistré.

### Import CSV et XLSX

`previewGameImport({ format, data, mapping? })` lit un `Uint8Array` de 5 Mo maximum, CSV UTF-8
ou première feuille XLSX, et retourne `{ headers, mapping, games, errors, valid }`. Les erreurs
indiquent ligne et champ. Aucun fichier n’est stocké et aucune formule n’est exécutée. Les lignes
vides sont ignorées. Les dates XLSX sont converties en date ISO ; les booléens usuels sont reconnus.

Le mapping associe `title`, `platform`, `period`, `completed`, `platinum` à des indices de colonnes
(à partir de zéro, `-1` ou champ omis pour ignorer un champ facultatif). `title` est obligatoire.
`detectGameColumns` et `buildGameImportPreview` de `@app/goty/import-preview` sont utilisables
dans le navigateur sans import serveur. Le parcours React de sélection, association, aperçu et
confirmation viendra au lot 5. Après confirmation, appeler `addGames` avec les jeux de l’aperçu
valide ; ce service revalide entièrement les données, l’acteur et la phase.

### Catalogue IGDB

`searchCatalog({ actorId, query }, opts?)` exige un membre connu et une recherche de 2 à 80
caractères. Sans `IGDB_CLIENT_ID` et `IGDB_CLIENT_SECRET`, retourne `{ available: false, games: [] }`.
Configurer une application Twitch dans sa console développeur et placer les deux clés dans
l’environnement serveur ; ne pas les exposer par des variables publiques. Aucun compte Twitch
n’est nécessaire pour les participants. Les deux variables sont relayées par `turbo.json`.

La recherche renvoie au plus 12 résultats, avec jaquette, plateformes et trailer identifié.
Le cache PostgreSQL expire après une heure et purge les entrées expirées à chaque alimentation.
Les jetons OAuth restent en mémoire serveur, avec renouvellement à expiration ou après un 401.
Un cache valide est réutilisable par une autre instance, indépendamment de son jeton en mémoire.
Des requêtes simultanées sur un cache vide peuvent chacune contacter IGDB, dans les limites communes.

Quotas PostgreSQL avec verrous consultatifs : 30 recherches par membre sur une fenêtre fixe
d’une minute (cache compris), 4 recherches fournisseur sur une fenêtre fixe d’une seconde.
Un dépassement local renvoie 429 ; une erreur ou un refus fournisseur renvoie 503 avec un
message invitant à la saisie manuelle. Chaque appel réseau a un délai maximum de 10 secondes.
Les appels réseau ont lieu hors transaction dans l’usage habituel ; éviter d’englober une
recherche externe dans une transaction applicative déjà ouverte, dont le délai reste imposé
par son appelant. Aucun jeton ou secret n’est écrit dans le cache.

## Pronostics et cérémonie (lot 4)

| Fonction                  | Entrée en plus de `actorId`, `editionId`              | Résultat                                                      |
| ------------------------- | ----------------------------------------------------- | ------------------------------------------------------------- |
| `setPrediction`           | `roundId`, `targetId`, `gameId` ou `null`             | `{ ok, version }`                                             |
| `controlEdition`          | `expectedVersion`, `action`, arguments selon l’action | `{ ok, version }`                                             |
| `setRoundOrder`           | `expectedVersion`, `roundIds` (permutation complète)  | `{ ok, version }`                                             |
| `getMemberSnapshot`       | Aucun                                                 | `MemberSnapshot` filtré selon le lecteur                      |
| `getPresentationSnapshot` | Aucun                                                 | `PresentationSnapshot`, sans privilège de lecture lié au rôle |

Les types `ControlInput`, `ControlAction`, `CeremonyScreen`, `MemberSnapshot` et
`PresentationSnapshot` sont exportés pour les futurs handlers et composants.

Les pronostics ouvrent en Préparation, y compris avant que la cible ait rempli son palmarès.
Ils sont modifiables pour les rubriques `draft` et `announced`, pour les autres participants
seulement, avec un jeu appartenant à la liste de la cible. À l’annonce, une cible sans choix est
neutralisée : sa réponse reste conservée mais ne rapporte aucun point. La fermeture bloque
modification et effacement ; les rubriques suivantes restent ouvertes.

Commandes réservées aux présentateurs et admins :

| Action        | Arguments spécifiques  | Conditions et effet                                                                        |
| ------------- | ---------------------- | ------------------------------------------------------------------------------------------ |
| `announce`    | `roundId`              | Prochaine rubrique `draft`, aucune rubrique active ; gel des choix, tirage et phase `live` |
| `lock`        | `roundId`              | `announced` → `locked`, pronostics fermés                                                  |
| `reopen`      | `roundId`              | `locked` ou `revealing`, zéro révélation ; retour à `announced`                            |
| `reveal`      | `roundId`              | `locked` ou `revealing`, cible restante ; exactement une révélation                        |
| `recap`       | `roundId`              | Toutes les cibles révélées, y compris zéro ; rubrique `done`, écran récapitulatif          |
| `leaderboard` | Aucun                  | Affichage temporaire des points, mémorisation de l’écran précédent                         |
| `resume`      | Aucun                  | Seulement depuis le classement temporaire, retour à l’écran précédent                      |
| `play`        | `targetId`             | Bande-son déjà révélée dans la rubrique affichée en mode rubrique ou récapitulatif         |
| `stop`        | Aucun                  | Arrêt de la commande audio                                                                 |
| `restart`     | `confirmRestart: true` | Retour en préparation avec remise à zéro des révélations ; choix et pronostics conservés   |
| `close`       | Aucun                  | Phase `live`, toutes les rubriques `done` ; archive en lecture seule                       |

Hors `restart`, chaque commande exige un état de présentation valide. Les commandes ne sont
permises qu’en Préparation ou Soirée. Le retour en préparation exige une confirmation explicite
dans l’entrée serveur ; l’interface devra expliquer que les spectateurs peuvent déjà avoir
mémorisé les réponses. Il ne rouvre pas les votes sur les catégories. Jeux, choix, pronostics et
conducteur sont conservés, les tirages sont effacés et les points dérivés retombent à zéro.

Toutes les commandes vérifient `expectedVersion` sous verrou d’édition. Un double clic, un rejeu
ou une seconde télécommande utilisant l’ancienne version reçoit 409 sans deuxième effet.
Après un conflit, rafraîchir l’état avant de proposer une nouvelle commande ; ne pas rejouer
automatiquement une révélation sur une nouvelle version. Le conducteur est modifiable par
organisateurs et présentateurs, mais les rubriques déjà commencées gardent leur position.

Le tirage aléatoire est créé à l’annonce et persisté, sans être transmis au navigateur. Une
rubrique vide se termine par annonce, fermeture et récapitulatif. Chaque bonne réponse révélée
rapporte un point, sans effet de la précision ou du média et sans récompense en monnaie. Les
ex æquo conservent leur rang (`1, 1, 3`). Les points sont calculés à la lecture, pas crédités dans
un compteur modifiable ou un ledger séparé.

### Projections et cohérence

`getMemberSnapshot` contient édition/version/écran, permissions, identités et rôles des membres,
compteurs globaux de préparation, listes partagées de jeux, rubriques, propositions, ses propres
choix et pronostics, et ceux dont la cible a été révélée. Les cibles éligibles d’une rubrique
ne sont indiquées qu’après annonce et triées indépendamment du tirage. Le classement n’est
visible que pour un présentateur/admin, quand il est affiché ou après clôture.

`getPresentationSnapshot` contient les identités minimales, les rubriques et leur seul préfixe
révélé, les choix et jeux effectivement révélés, les pronostics correspondants, et le classement
uniquement lorsqu’il est affiché ou archivé. Aucun choix personnel encore secret, rôle, compteur
de préparation ou liste de cibles futures, même pour une TV connectée avec le compte admin.
Une archive est ouverte à tous les membres du portail ; les pronostics neutralisés restent
privés sauf pour leur auteur.

Les deux projections utilisent un JSON d’écran validé avec champs autorisés. Une commande audio
ne peut référencer qu’un choix révélé ; chaque lancement porte un nonce, conservé lors d’une
simple reconnexion et renouvelé lors d’une nouvelle lecture. Les changements d’écran arrêtent
l’audio, sauf une révélation de bande-son qui remplace la lecture précédente. Les lecteurs,
leurs contrôles de son et la suspension de la musique du portail sont intégrés à l’interface.

Toutes les lectures GOTY d’un snapshot s’exécutent sous le verrou partagé de l’édition, qui
reste détenu jusqu’à la fin de la transaction. Les écritures métier prennent le verrou exclusif
sur cette même ligne ; cela stabilise les données même en isolation PostgreSQL READ COMMITTED,
y compris dans une transaction fournie via `{ tx }`. Les services `core` fournissent séparément
les noms et images publics. Les handlers vérifient la session, renvoient `private, no-store`
et ne mettent pas en cache les projections entre acteurs.

## Interface et HTTP (lot 5)

L’export `@app/goty/ui` contient les composants React sans dépendance à Next ; les liens
passent par `AppLink`. Les pages web contrôlent la session et transmettent les projections
serveur. `/goty/:editionId` propose les onglets jeux, palmarès, catégories, pronostics,
organisation, cérémonie et archives. L’organisation exige les droits correspondants.
`/goty/:editionId/tv` utilise un layout sans colonne de portail et uniquement la projection TV.

Le handler `/api/goty/[...path]` expose les services décrits dans le contrat fonctionnel.
Il ajoute `GET /editions/:id/eligible-members`, `POST /editions/:id/import-preview` et
`PUT /editions/:id/top` (`{ gameIds }`). Le top est remplacé atomiquement : permutation de
ses jeux, précisions conservées et places figées inchangées. L’aperçu reçoit les octets CSV/XLSX
avec `format` et une correspondance JSON `mapping` facultative en paramètres ; aucune écriture
avant confirmation via `POST games`. Limites : 5 Mio pour l’aperçu, 2 Mio pour le JSON.

Chaque requête vérifie l’appartenance au portail, puis les services vérifient les droits de
l’édition. L’acteur vient exclusivement de la session. Les mutations exigent une origine
identique à `BETTER_AUTH_URL` et refusent `Sec-Fetch-Site: cross-site`. Les réponses privées,
erreurs comprises, portent `Cache-Control: private, no-store`. Les lectures conditionnelles
revérifient la session et les droits avant tout 304 ; leur ETag inclut version, projection,
identité et permissions. `x-goty-viewer` permet au client de détecter un changement de compte.

Le polling ne chevauche pas les requêtes et fonctionne toutes les trois secondes, seulement
quand l’onglet est visible ; retour au premier plan = actualisation immédiate. Une génération
de requête ignore les réponses obsolètes même si l’annulation réseau est ignorée. Les mutations
ne sont jamais rejouées automatiquement et rechargent l’état après conflit. Un changement de
compte ou une révocation efface la vue privée ; la navigation d’édition remonte les composants.
Le top et le conducteur se déplacent par poignée tactile/souris, flèches clavier ou boutons.

Les lecteurs YouTube utilisent le domaine nocookie ; leur démontage arrête la lecture. Les
bandes-son nécessitent une activation sur chaque TV et suivent le nonce de la commande, sans
redémarrer à chaque poll. Un arrêt local, une nouvelle lecture distante, le volume commun et le
plein écran sont disponibles. `claimMediaFocus` suspend les médias du portail et reprend les
boucles après fermeture du dernier lecteur. Sans trailer, une recherche YouTube est proposée.
La lecture effective dépend du navigateur et des restrictions YouTube ; le lien externe reste
accessible. Aucune vidéo ni jaquette externe n’est recopiée dans le stockage du portail.

La recette locale a utilisé des comptes et jeux fictifs dans une base séparée : top, second
compte, pronostic, télécommande, rubrique vide et révélation TV. Vue mobile contrôlée à 390 px.
Les tests DOM couvrent réponses tardives, navigation, compte changé, révocation, onglet masqué
et priorité média. Les tests web couvrent les sessions, origines, tailles et projections/304.
Validation locale du lot 5 : 114 tests GOTY, 156 tests web et 43 tests core réussis ;
TypeScript, ESLint, formatage, frontières et build de production vérifiés. Les tests DOM ont
également été relancés après la correction de l’arrêt volontaire d’une musique suspendue.
La suite globale nécessite le stockage S3 du projet : l’émulateur S3rver utilisé pour la recette
ne vérifie pas le Content-Type d’un PUT présigné comme RustFS/R2 et échoue sur ce test existant.
Le lot 6 ajoute les tests de notifications et médias décrits ci-dessous. La recette exhaustive
sur matériel et fournisseurs réels reste au lot 7.

## Services communs et médias (lot 6)

Les identités sont lues via `core` ; aucun profil ni portrait supplémentaire n’est stocké.
Les services d’inscription, d’ouverture de préparation et de pilotage émettent des notifications
via `core.notify`, dans leur transaction et sous le verrou d’édition. Seuls les nouveaux inscrits
ou les participants actuels sont ciblés ; l’acteur est exclu et les identités supprimées ignorées.
Messages fixes avec année et lien interne, sans nom libre d’édition, réponse, média ou score.
Le début de soirée n’est notifié qu’à la première annonce après préparation ; un retour en
préparation et une relance volontaire constituent de nouvelles transitions. Pas de message par
révélation, vote ou commande audio, pas de fil d’activité ni de notification externe.

Les notifications sont annulées avec l’action si sa transaction échoue. Les accès au lien sont
revérifiés au moment de l’ouverture ; un ancien message ne conserve aucun droit. Tests PostgreSQL :
nouveaux inscrits, acteur/retrait/non-participant, rôle inchangé, concurrence, rejeu, rollback,
identité supprimée, profils actualisés et absence de contenu privé dans les messages/l’activité.

Le lecteur utilise l’API YouTube officielle, chargée à l’ouverture, pour appliquer le volume
avant lecture, signaler les erreurs et l’autoplay bloqué, puis détruire le lecteur à la fermeture.
Il ne reprend au retour d’onglet qu’une vidéo qui jouait avant masquage. Les iframes restent
visibles (minimum 200 × 200), en nocookie avec origine et politique de referrer explicites.
Les jaquettes en erreur deviennent une icône et le catalogue est attribué à IGDB. Aucun objet
R2 ni nouveau cache média ; voir le guide pour les sources fournisseurs consultées le
1er novembre 2026, les limites externes et les procédures d’exploitation. Aucun nouveau réglage,
script versionné ou objet SQL pour ce lot. Les tests DOM simulent YouTube sans requête réelle.

Validation du lot 6 : 123 tests GOTY, 156 tests web et 43 tests core réussis sur PostgreSQL 17
avec stockage local simulé ; TypeScript, ESLint, frontières, formatage et build vérifiés.
L’émulateur conserve la limite de signature S3 décrite au lot 5. Les outils clients PostgreSQL
de sauvegarde/restauration ne sont pas installés sur l’environnement de recette : la procédure
est documentée, sa répétition effective sur sauvegarde d’exploitation reste au lot 7.

## Règles pures

`initialRounds`, `BASE_CATEGORIES`, `normalizeCategoryName`, `votesNeeded`, `shuffle`,
`rankScores`, `predictionOpen`, `youtubeId`, types `Phase` et `RoundStatus`. Tirages côté
serveur via `node:crypto` ; aucun import Next.

## Vérifications

Depuis la racine, avec les dépendances installées et PostgreSQL lancé :

```sh
pnpm db:generate
pnpm --filter @app/goty test
pnpm --filter @app/goty lint
pnpm --filter @app/goty typecheck
pnpm check:boundaries
```

Les tests appliquent les migrations puis vident la base désignée par `TEST_DATABASE_URL`, dont
le nom doit finir par `_test`. Ne pas les exécuter en parallèle avec les autres packages sur la
même base. Les fixtures sont fictives. Les tests couvrent règles pures, accès, archives, identités,
retrait, rôles, concurrence, validation, rollback, préparation, confidentialité et imports
CSV/XLSX, pronostics, cycle complet de cérémonie, audio, archives et snapshots. Les tests de
concurrence couvrent les doubles révélations, les courses de fermeture/réouverture et une lecture
bloquée par une révélation non validée. IGDB et Twitch sont simulés : aucune clé réelle ni requête fournisseur.
