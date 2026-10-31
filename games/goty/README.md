# GOTY Party dans Potopia

Le lot 2 livre le socle serveur de `@app/goty`. Il n’ajoute encore ni page, ni route HTTP, ni
tuile au portail. Le portage de la préparation, des pronostics et de la cérémonie vient ensuite.

- [Plan des lots](../../docs/PLAN_INTEGRATION_GOTY_PARTY.md)
- [Contrat fonctionnel et recette](../../docs/CONTRAT_FONCTIONNEL_GOTY_PARTY.md)

## Données

Migration additive `20261031230000_goty`, sans transfert depuis goty-party et sans modification
des données des autres domaines. Le schéma PostgreSQL `goty` contient huit tables :

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

Phases : `categories`, `preparation`, `live`, `closed`. Statuts de rubrique : `draft`,
`announced`, `locked`, `revealing`, `done`. Les transitions seront implémentées dans les lots
suivants. Les tableaux de révélation contiennent des identifiants utilisateurs de type chaîne.

Les FK restent internes à GOTY. Les identités sont obtenues via les services de `core` et aucun
compte ou session GOTY n’est créé. Les futurs services de choix et pronostics devront vérifier
que jeux, rubriques, propriétaires et cibles appartiennent à la même édition ; les FK seules
ne remplacent pas ces contrôles métier. Les suppressions de jeux référencés sont restreintes.
Le conducteur utilise une contrainte unique de position : son futur réordonnancement devra
passer par des positions temporaires dans une transaction pour éviter les collisions.

## API serveur disponible

Toutes les fonctions proviennent de `@app/goty`, à l’exception des règles pures exportées par
`@app/goty/rules`. L’appelant doit d’abord vérifier la session avec `requireMember` ou les
helpers de `apps/web`, puis fournir son identifiant applicatif comme `actorId`. Ce champ ne
doit jamais être recopié depuis une entrée du navigateur.

Les droits d’admin sont relus via `core.isAdmin`, sans faire confiance au rôle stocké en base.
Les fonctions acceptent toutes `opts?: { tx?: DbTx }` ; les écritures rejoignent la transaction
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
`NOT_FOUND` (404), `CONFLICT` (409). Les erreurs ne contiennent pas les entrées privées.

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
retrait, rôles, concurrence, validation et rollback d’une transaction composée. Aucune variable
d’environnement supplémentaire n’est requise pour ce lot.
