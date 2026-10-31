# GOTY Party dans Potopia

Les lots 2 et 3 livrent le socle serveur et la préparation de `@app/goty`. Ils n’ajoutent encore
ni page, ni route HTTP, ni tuile au portail. Pronostics et cérémonie viennent au lot 4, les
interfaces React au lot 5. Les lecteurs et aperçus d’import sont prêts pour ces interfaces.

- [Plan des lots](../../docs/PLAN_INTEGRATION_GOTY_PARTY.md)
- [Contrat fonctionnel et recette](../../docs/CONTRAT_FONCTIONNEL_GOTY_PARTY.md)

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

Phases : `categories`, `preparation`, `live`, `closed`. Le passage en préparation est disponible ;
la soirée et la clôture viendront au lot 4. Statuts de rubrique : `draft`, `announced`, `locked`,
`revealing`, `done`. Les tableaux de révélation contiennent des identifiants de type chaîne.

Les FK restent internes à GOTY. Les identités sont obtenues via les services de `core` et aucun
compte ou session GOTY n’est créé. Les services de choix vérifient édition, rubrique et propriétaire
du jeu ; les futurs pronostics devront vérifier aussi leur cible. Les FK seules ne remplacent
pas ces contrôles métier. Les suppressions de jeux référencés sont restreintes.
Le conducteur utilise une contrainte unique de position : son futur réordonnancement devra
passer par des positions temporaires dans une transaction pour éviter les collisions.

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
`listEditionMembers` ne fournit pas encore les compteurs de préparation du futur snapshot.
Aucune de ces vues ne constitue le `MemberSnapshot` complet ni la projection TV du contrat.

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
Les trous temporaires du top restent possibles pendant l’édition ; le lot 4 les vérifiera à
l’annonce. La précision est limitée à 500 caractères. YouTube est réservé à la bande-son,
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
CSV/XLSX. IGDB et Twitch sont simulés dans les tests : aucune clé réelle ni requête fournisseur.
