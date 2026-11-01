# GOTY Party — contrat fonctionnel d’intégration

Lot 1, version du 31 octobre 2026. Référence pour les lots suivants ; aucune fonctionnalité
applicative n’est livrée par ce document.

## 1. Périmètre et décisions

GOTY Party permet de préparer des palmarès individuels et de deviner ceux des autres pendant une
cérémonie. Il ne désigne pas de gagnant collectif parmi les jeux.

Décisions confirmées par l’utilisateur pour l’intégration :

- **Départ à zéro** : aucune édition, aucun compte, palmarès, pronostic ou média de goty-party
  n’est importé. Le dépôt source et ses données restent conservés séparément.
- **Archives accessibles à tous les membres de Potopia**, y compris ceux qui n’ont pas participé.
  Elles restent privées vis-à-vis des visiteurs non connectés.

Le premier périmètre conserve les parcours actuels : éditions annuelles, catégories, listes de
jeux, palmarès, pronostics, cérémonie, télévision et archives. L’identité vient de Discord via
Potopia ; aucun compte, mot de passe ou avatar personnel supplémentaire. Pas de récompense en
monnaie, de boosters ou de serveur temps réel dans ce périmètre.

Les règles ci-dessous fixent la cible proposée pour l’implémentation. Les adaptations par rapport
à la source sont explicites en section 8 ; elles ne sont pas présentées comme des décisions
supplémentaires expressément validées par l’utilisateur.

## 2. Références et méthode

Source étudiée : dépôt local goty-party, commit `25acd48`. Références relatives à ce dépôt :

| Référence                                                 | Utilisation                                                 |
| --------------------------------------------------------- | ----------------------------------------------------------- |
| `CAHIER_DES_CHARGES.md`, sections 1 à 8                   | Parcours, rôles, confidentialité, règles de soirée          |
| `apps/api/src/routes.ts`                                  | Conditions effectives des commandes et validations          |
| `apps/api/src/domain.ts`                                  | Seuils, classement, catégories initiales, tirage et YouTube |
| `apps/api/src/editions.ts`                                | Accès, verrouillage et projection selon le lecteur          |
| `apps/api/src/integration.test.ts`                        | Confidentialité, pronostics, révélation, médias et archives |
| `apps/api/src/lifecycle.integration.test.ts`              | Phases, inscriptions, concurrence et catégories             |
| `apps/web/src/types.ts`, `store.ts`, `views/Ceremony.vue` | Contrats client, synchronisation et télévision              |
| `apps/web/src/gameImport.ts` et ses tests                 | Mapping des colonnes et valeurs importées                   |

Cible : règles de `CLAUDE.md`, architecture et modules de Potopia. La comparaison est une lecture
du code et des tests ; les tests source n’ont pas été exécutés pour ce lot documentaire.

## 3. Acteurs et droits

Tous les accès nécessitent une session Potopia membre valide. Les pouvoirs d’admin sont recalculés
depuis la configuration du portail. Organisateur et présentateur sont des rôles d’édition,
cumulables. Dans la première version, ils sont attachés à une inscription de participant, comme
dans la source ; participer n’oblige ni à remplir un palmarès ni à pronostiquer.

Les droits se cumulent : un admin non inscrit peut gérer et présenter, mais doit être inscrit
pour saisir des jeux, des choix ou des pronostics. Aucun cumul ne donne accès aux choix secrets
des autres. Un rôle d’une édition ne donne pas de droits sur les autres éditions.

| Action                                                      | Membre hors édition | Participant | Organisateur                            | Présentateur | Admin Potopia |
| ----------------------------------------------------------- | ------------------- | ----------- | --------------------------------------- | ------------ | ------------- |
| Voir une édition active                                     | Non                 | Oui         | Oui                                     | Oui          | Oui           |
| Consulter une archive                                       | Oui                 | Oui         | Oui                                     | Oui          | Oui           |
| Créer une édition                                           | Non                 | Non         | Oui, si déjà organisateur d’une édition | Non          | Oui           |
| Gérer participants et désigner présentateurs                | Non                 | Non         | Oui                                     | Non          | Oui           |
| Désigner ou retirer un organisateur                         | Non                 | Non         | Non                                     | Non          | Oui           |
| Proposer et voter sur les catégories                        | Non                 | Oui         | Oui                                     | Oui          | Si inscrit    |
| Ouvrir la préparation / ajouter une catégorie               | Non                 | Non         | Oui                                     | Non          | Oui           |
| Gérer ses jeux, son palmarès et ses pronostics              | Non                 | Oui         | Oui                                     | Oui          | Si inscrit    |
| Modifier les données personnelles d’un autre                | Non                 | Non         | Non                                     | Non          | Non           |
| Réordonner les rubriques à venir                            | Non                 | Non         | Oui                                     | Oui          | Oui           |
| Annoncer, fermer, rouvrir, révéler, récapituler             | Non                 | Non         | Si aussi présentateur                   | Oui          | Oui           |
| Piloter classement, audio, retour en préparation et clôture | Non                 | Non         | Si aussi présentateur                   | Oui          | Oui           |
| Lire les choix secrets d’autrui                             | Non                 | Non         | Non                                     | Non          | Non           |

Toutes les écritures sont interdites après clôture. Les phases limitent les droits de la matrice.
Un organisateur ne peut ni s’enlever son rôle ni modifier la liste des organisateurs. Un admin
peut changer les rôles jusqu’à la clôture. La création inscrit automatiquement son auteur comme
organisateur et présentateur. La liste des membres sélectionnables passe par `core`, ne renvoie
que l’identifiant applicatif, le nom et l’image utiles, et concerne les membres déjà connus du
portail ; aucune création de compte Discord depuis GOTY.

### Inscriptions et suivi

- En Catégories : ajout et retrait possibles ; retrait refusé si la personne a déjà des jeux.
  Un retrait autorisé retire ses propositions et ses votes de l’édition, sans affecter une autre.
- En Préparation : ajouts possibles, retraits interdits ; catégories adoptées inchangées.
- En Soirée : ensemble des participants figé ; rôles encore modifiables.
- En Archives : participants et rôles figés.
- La liste ne peut être vide et ne peut contenir de doublon. Chaque identifiant doit correspondre
  à un utilisateur du portail. Le suivi expose le nombre de jeux et de choix par personne, sans
  indiquer dans quelles rubriques les choix encore secrets sont remplis.
- Une session révoquée perd immédiatement l’accès dès le contrôle serveur, sans suppression de
  l’historique. L’inscription à une édition ne contourne pas les contrôles de Potopia.

## 4. Parcours et règles métier

### Édition et catégories

Une édition par année, année comprise entre 2000 et 2200 ; nom non vide de 100 caractères maximum.
L’accueil liste les éditions actives accessibles et les archives, par année décroissante.

À la création : cinq rubriques Top 5 à Top 1, puis neuf prix : Coup de cœur, Déception, Meilleure
bande-son, Meilleure direction artistique, Meilleur gameplay, Meilleur scénario, Meilleur
personnage, Meilleure expérience à plusieurs, Meilleure ambiance / immersion.

En Catégories, les participants proposent et votent ; une proposition a un nom de 2 à 100
caractères. Proposer n’attribue pas un vote implicite.
Un vote favorable peut être retiré. Une proposition est adoptée à l’ouverture de la Préparation
si elle atteint `ceil(0,75 × nombre de participants)`. Exemple : 6 participants exigent 5 votes.
L’abstention ne vaut pas accord. Les prix de base ne sont pas soumis au vote.

L’organisateur enregistre d’abord les participants, puis ouvre explicitement la Préparation.
Propositions et votes sont alors fermés. Il peut ajouter un prix directement pendant cette phase :
nom obligatoire, 100 caractères maximum, ajouté en fin de conducteur. Les noms de prix doivent
être distincts des rubriques existantes après normalisation des accents, casse, apostrophes et
espaces. La même normalisation s’applique aux propositions pour éviter des rubriques en double.

### Jeux et imports

Les participants renseignent les jeux auxquels ils ont joué dans l’année, indépendamment de
leur date de sortie. Le fait de les avoir terminés reste une convention sans vérification.
Les listes sont partagées avec les lecteurs autorisés de l’édition, contrairement aux palmarès.

Champs : titre obligatoire (200 caractères), plateforme et période facultatives (100 chacune),
indicateurs Terminé et Platine, référence IGDB, jaquette et identifiant YouTube de trailer
facultatifs. Pas de contrôle imposant qu’un jeu Platine soit marqué Terminé.

Ajout, modification, suppression et import sont permis uniquement en Catégories et Préparation,
pour ses propres jeux. La première annonce fige toutes les listes. Un jeu utilisé dans un choix
doit d’abord en être retiré ; un jeu utilisé dans un pronostic est conservé. Les doublons de
titre sont autorisés : aucun rapprochement ou remplacement automatique.

Import CSV/XLSX : sélectionner, associer les colonnes, prévisualiser, confirmer. Seuls les jeux
sont importés, par lot de 1 à 1000 lignes. Une ligne invalide invalide le lot entier ; afficher
les erreurs avant confirmation autant que possible. Les cellules sont traitées comme des
données, sans exécution de formule. Les valeurs `x`, `oui`, `yes`, `true`, `1`, `vrai`, `✓`
signifient vrai, sans distinction de casse ni espaces autour. Les lignes vides sont ignorées.

Précisions du lot 3 : fichier limité à 5 Mo, CSV en UTF-8 ou première feuille d’un XLSX.
L’aperçu indique les lignes et champs invalides ; la confirmation revalide le lot et les droits
avant écriture. Les dates XLSX sont converties en date ISO. Les formulaires sont intégrés au lot 5.

Recherche IGDB facultative, côté serveur ; saisie manuelle toujours possible. Trailer intégré
si connu, recherche YouTube de secours sinon ; fermer le lecteur arrête la lecture. Aucun fichier
vidéo n’est envoyé. Une indisponibilité du catalogue ne bloque pas la préparation manuelle.

### Palmarès personnel

À partir de la Préparation, chaque participant choisit ses propres jeux. Le top comporte au plus
cinq jeux distincts, sans trou à partir de la place 1 au moment d’une annonce de rubrique du top.
Un top court ou vide est autorisé. Le même jeu peut recevoir plusieurs prix et figurer au top.
Chaque prix peut rester vide, ou porter sur un jeu principal avec une précision de 500 caractères
maximum. Seul le jeu principal compte pour les points.

Seule la rubrique Meilleure bande-son accepte un lien YouTube facultatif (255 caractères),
validé puis normalisé. La précision et le lien suivent la confidentialité du choix. Pas de bouton
de validation globale : les choix se sauvegardent et restent modifiables tant que leur rubrique
est `draft`, y compris pendant la soirée. Retirer un choix ne supprime pas les pronostics.

### Pronostics et classement

Facultatifs, ouverts en Préparation puis en Soirée pour les rubriques `draft` ou `announced`.
Un participant peut choisir un jeu de la liste d’un autre participant, jamais pour lui-même.
Il n’est pas nécessaire que la cible ait déjà rempli son palmarès ; sa liste doit offrir un jeu.
Une seule réponse par auteur, cible et rubrique, remplaçable ou effaçable tant que le vote est ouvert.

À l’annonce, les cibles sans choix sont exclues du tirage : leurs pronostics sont neutralisés,
conservés sans point et non modifiables pour cette rubrique. À la fermeture, aucun pronostic
n’est modifiable. Réouverture possible seulement avant la première révélation.

Un jeu correctement deviné vaut un point lors de sa révélation. Aucun point pour précision,
musique ou réponse orale. Une modification de choix avant annonce conserve les pronostics ; le
score porte sur la réponse effectivement révélée. Classement avec ex æquo et rangs de compétition
(`1, 1, 3`). Le présentateur peut le consulter ; les autres le voient quand il est affiché,
puis en permanence dans les archives.

### Cérémonie, télévision et archives

La TV est une page dédiée authentifiée, sans commandes ni données personnelles non révélées.
Elle utilise l’état de présentation, même si son compte est aussi participant ou admin.
Le présentateur utilise une télécommande distincte sur téléphone, tablette ou ordinateur.

Chaque rubrique tire une permutation aléatoire des seuls participants ayant un choix, persistée
à l’annonce. Une révélation manuelle ajoute exactement une personne ; aucun déroulement automatique.
Une rubrique vide passe par annonce, fermeture puis récapitulatif sans révélation.

Affichage : attente, rubrique (dernier choix révélé), récapitulatif (tous les choix révélés de la
rubrique) et classement. Le classement temporaire peut être quitté pour reprendre l’écran
précédent ; le demander deux fois ne remplace pas cet écran précédent par lui-même.

Sur la TV seulement, révéler une bande-son tente de lancer sa vidéo ; le choix suivant arrête la
précédente. Le présentateur peut relancer une musique déjà révélée ou l’arrêter. Une nouvelle
lecture possède un identifiant distinct pour synchroniser les lecteurs sans lecture doublée.
Un clic peut être nécessaire pour activer le son. Ouvrir un trailer coupe localement la bande-son.
La musique du portail est suspendue pendant la lecture GOTY.

Après reconnexion, les écrans reprennent l’état courant sans perdre choix, pronostics ou points.
Les anciennes réponses réseau ne remplacent pas une édition ou session nouvellement sélectionnée.
Les données se rafraîchissent pendant la cérémonie ; objectif de recette : affichage sous cinq
secondes sur un réseau local de test normal, hors vidéo externe.

La clôture exige toutes les rubriques `done`. Les archives offrent listes de jeux, palmarès par
personne, comparaison par rubrique et classement avec détail des bonnes réponses. Aucune édition
clôturée ne peut être réouverte ou modifiée dans ce périmètre.

### Notifications et médias (lot 6)

Notifications internes aux nouveaux inscrits, puis aux participants actuels lors de l’ouverture
de préparation, première annonce de soirée, retour effectif en préparation et clôture. Exclure
l’acteur et les identités supprimées. Ne notifier ni chaque rubrique ni chaque révélation ;
une relance volontaire après retour en préparation ouvre un nouveau cycle. Écriture atomique
avec l’action métier : rollback = aucun message, rejeu versionné = aucun doublon.
Contenu fixe : GOTY, année, phrase d’étape et lien interne, sans nom libre ni information privée.
Pas d’activité publique, d’email ou de message Discord dans ce périmètre. Les liens restent soumis
aux droits courants. Les profils sont ceux du portail, sans copie métier.

Jaquettes IGDB distantes attribuées avec icône de repli ; vidéos lues via le lecteur officiel
YouTube visible, jamais téléchargées ou extraites. Activation TV manuelle, volume avant lecture,
message si bloqué/indisponible et lien externe. Aucun nouveau média privé ni cache binaire.
Voir le [guide d’exploitation](EXPLOITATION_GOTY_PARTY.md) pour les sources et procédures.

## 5. Transitions et invariants

| Commande               | Conditions                                                                                                    | Effet                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Créer                  | Droit de création, année libre                                                                                | `categories`, rubriques initiales, auteur inscrit                                                           |
| Préparer               | Organisateur/admin, `categories`                                                                              | Adoption des propositions, phase `preparation`                                                              |
| Annoncer               | Présentateur/admin, `preparation` ou `live`, prochaine rubrique `draft`, aucune rubrique active               | Phase `live`, rubrique `announced`, choix figés, tirage des cibles, écran rubrique                          |
| Fermer                 | Rubrique `announced`                                                                                          | `locked`, pronostics fermés                                                                                 |
| Rouvrir                | Rubrique `locked` ou `revealing`, zéro révélation                                                             | `announced`, pronostics ouverts pour les cibles retenues                                                    |
| Révéler                | Rubrique `locked` ou `revealing`, au moins une cible restante                                                 | `revealing`, compteur +1, affichage et audio actualisés                                                     |
| Récapituler            | `locked`, `revealing` ou `done`, toutes les cibles révélées                                                   | `done`, écran récapitulatif, audio arrêté                                                                   |
| Classer / reprendre    | Présentateur/admin, `preparation` ou `live`                                                                   | Écran temporaire / précédent, sans modifier les statuts, audio arrêté                                       |
| Lire / arrêter         | Présentateur/admin, `preparation` ou `live` ; lire exige une bande-son déjà révélée dans la rubrique affichée | État audio modifié                                                                                          |
| Revenir en préparation | Présentateur/admin, `preparation` ou `live`, confirmation explicite                                           | Tous les statuts `draft`, tirages et compteurs effacés, écran attente ; jeux, choix et pronostics conservés |
| Clôturer               | Présentateur/admin, `live`, toutes les rubriques `done`                                                       | `closed`, classement final, audio arrêté, lecture seule                                                     |

Le retour en préparation rouvre listes, choix et pronostics, permet de nouveaux participants,
conserve les catégories et ne rouvre pas les votes. Les points retombent à zéro car aucune réponse
n’est désormais révélée. Les spectateurs peuvent avoir mémorisé les réponses : avertissement
explicite dans la confirmation, aucun prétendu effacement de ce qu’ils ont vu.

Le conducteur contient chaque rubrique exactement une fois. Seules les rubriques `draft` peuvent
être déplacées ; les autres conservent leur position. Les tops restent modifiables rubrique par
rubrique ; ils doivent être contigus à chaque annonce d’une rubrique du top.

Toute commande valide est atomique et incrémente la version d’édition. Un refus n’altère aucune
donnée. Les écritures concurrentes se sérialisent par édition. Les commandes de présentation
envoient `expectedVersion` : version périmée = conflit et rafraîchissement, sans deuxième effet.
Ce contrôle est étendu aux mises à jour du conducteur et des inscriptions pour éviter les
remplacements concurrents silencieux. Une lecture retourne un état cohérent d’une même version.

## 6. Contrats HTTP et données visibles

Contrat implémenté au lot 5, avec identifiants opaques de type chaîne ; noms JSON en camelCase. Les services
métier restent indépendants de Next et acceptent `{ tx }` pour leurs écritures.

| Route sous `/api/goty`                             | Entrée principale                                                  | Sortie                                                   |
| -------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------- |
| `GET /editions`                                    | Aucune                                                             | `{ editions: EditionSummary[] }`, uniquement accessibles |
| `POST /editions`                                   | `{ year, name }`                                                   | 201, `{ id, version }`                                   |
| `GET /editions/:id`                                | Aucune                                                             | `MemberSnapshot`, filtré selon le lecteur                |
| `GET /editions/:id/presentation`                   | Aucune                                                             | `PresentationSnapshot`, y compris pour la TV             |
| `PUT /editions/:id/members`                        | `{ expectedVersion, members: [{ userId, organizer, presenter }] }` | `{ ok: true, version }`                                  |
| `POST /editions/:id/proposals`                     | `{ name }`                                                         | 201, `{ id, version }`                                   |
| `PUT /editions/:id/proposals/:proposalId/vote`     | `{ favor }`                                                        | `{ ok: true, version }`                                  |
| `POST /editions/:id/prepare`                       | `{ expectedVersion }`                                              | `{ ok: true, version }`                                  |
| `POST /editions/:id/rounds`                        | `{ name }`                                                         | 201, `{ id, version }`                                   |
| `POST /editions/:id/games`                         | `{ games: GameInput[] }`                                           | 201, `{ ok: true, version }`                             |
| `PATCH /editions/:id/games/:gameId`                | `GameInput` complet                                                | `{ ok: true, version }`                                  |
| `DELETE /editions/:id/games/:gameId`               | Aucune                                                             | `{ ok: true, version }`                                  |
| `PUT /editions/:id/choices/:roundId`               | `{ gameId: Id ou null, precision?, youtube? }`                     | `{ ok: true, version }`                                  |
| `PUT /editions/:id/predictions/:roundId/:targetId` | `{ gameId: Id ou null }`                                           | `{ ok: true, version }`                                  |
| `PUT /editions/:id/order`                          | `{ expectedVersion, roundIds: Id[] }`                              | `{ ok: true, version }`                                  |
| `POST /editions/:id/control`                       | `{ expectedVersion, action, roundId?, targetId? }`                 | `{ ok: true, version }`                                  |
| `GET /catalog?q=...`                               | Recherche de 2 à 80 caractères, session membre                     | `{ games: CatalogGame[], available: boolean }`           |

`action` appartient à `announce`, `lock`, `reopen`, `reveal`, `recap`, `leaderboard`, `resume`,
`restart`, `close`, `play`, `stop`. Valider les champs requis selon l’action. Un identifiant reçu
est toujours vérifié contre son édition, son propriétaire et les permissions ; l’acteur vient
de la session et jamais du corps de requête.

Précisions du lot 4 : `restart` exige aussi `confirmRestart: true`. Les commandes
`announce`, `lock`, `reopen`, `reveal`, `recap` exigent `roundId` ; `play` exige `targetId`.
`resume` est réservé au classement temporaire ; `play` exige un écran de rubrique ou de
récapitulatif. Les types serveur `ControlInput` décrivent ces variantes. Les deux snapshots sont
implémentés côté serveur et exposés via des routes authentifiées `private, no-store`.
Les mutations vérifient l’origine et refusent les requêtes cross-site. Le 304 revérifie session
et droits ; son ETag est propre à l’acteur, à ses permissions, à la projection et à la version.

Compléments du lot 5 : `GET /editions/:id/eligible-members` pour les organisateurs,
`POST /editions/:id/import-preview?format=csv|xlsx&mapping=JSON` (octets, 5 Mio maximum) et
`PUT /editions/:id/top` (`{ gameIds: Id[] }`). Le top est remplacé atomiquement, conserve les
précisions des jeux déplacés et interdit de modifier une place figée. Les entrées JSON sont
limitées à 2 Mio. L’aperçu n’écrit rien ; la confirmation utilise le contrat `POST games`.

`GameInput` : `title`, `platform?`, `period?`, `completed?`, `platinum?`, `igdbId?`, `cover?`,
`trailerYoutubeId?`, avec les limites de la section 4. Chaînes facultatives par défaut vides,
indicateurs faux, métadonnées externes nulles. Référence IGDB entière positive ; jaquette HTTPS
sur l’hôte exact `images.igdb.com` ; identifiant vidéo de 11 caractères alphanumériques, `_` ou
`-`. `CatalogGame` fournit `igdbId`, `title`, `platforms`, `cover`, `trailerYoutubeId`. Une
précision absente devient vide ; un lien absent devient nul. `Id` désigne une chaîne opaque
validée ; aucun client ne doit supposer que les identifiants utilisateurs sont numériques.

`EditionSummary` : `id`, `year`, `name`, `phase`. `MemberSnapshot` contient :

- `edition` : résumé, `version`, `screen` (mode, rubrique, commande audio et écran précédent utile).
- `permissions` : `organize`, `present`, `participate` calculés côté serveur.
- `members` : `id`, `name`, `image`, rôles, `gameCount`, `choiceCount` ; aucun email ni ID Discord.
- `games` : identifiant, propriétaire et champs partagés du jeu.
- `rounds` : identifiant, nom, place du top, position, statut, bande-son, compteur, personnes
  révélées dans l’ordre ; liste des cibles éligibles triée et nombre uniquement après annonce.
- `choices` : ses propres choix et ceux effectivement révélés, précision et YouTube compris.
- `predictions` : les siens, plus ceux portant sur une réponse effectivement révélée.
- `proposals` : identifiant, nom, nombre de votes et indicateur de son propre vote ; pas de liste
  des votants.
- `standings` : points et rangs si présentateur/admin, écran classement ou archive ; sinon `null`.

`PresentationSnapshot` : édition/version/écran, identité minimale des participants, rubriques,
choix et jeux **effectivement révélés**, pronostics correspondants et classement uniquement
quand affiché ou archivé. Ni ses propres choix cachés, ni listes complètes de jeux, ni indicateurs
de préparation. Le serveur applique cette projection même si la TV utilise le compte du présentateur.

| Donnée                            | Avant révélation                        | Après révélation                                      | Archives                                         |
| --------------------------------- | --------------------------------------- | ----------------------------------------------------- | ------------------------------------------------ |
| Liste de jeux d’un participant    | Lecteurs autorisés de l’édition         | Identique                                             | Tous les membres Potopia                         |
| Choix, précision et musique       | Auteur seul, jamais TV                  | Tous les lecteurs autorisés                           | Tous les membres Potopia                         |
| Pronostic                         | Auteur seul                             | Visible si sa cible a été révélée pour cette rubrique | Même règle ; neutralisés privés sauf leur auteur |
| Ordre futur de révélation         | Jamais transmis                         | Seul le préfixe révélé est transmis                   | Ordre révélé complet                             |
| Nombre global de choix par membre | Lecteurs autorisés, hors TV             | Identique                                             | Lecture seule                                    |
| Classement                        | Présentateur/admin, ou écran classement | Même règle                                            | Tous les membres Potopia                         |

Les réponses privées sont `no-store`, sans cache partagé entre acteurs ou projections. Les logs,
notifications et activités ne contiennent aucun choix ou pronostic secret. Réponses d’erreur :
`{ error: { code, message } }`, sans payload privé. Statuts cibles : 400 validation, 401 absence
de session, 403 session révoquée ou accès interdit, 404 ressource inexistante dans le périmètre
autorisé, 409 état/version/contrainte métier, 429 limite de requêtes, 503 catalogue indisponible
si l’appel ne peut pas fournir de résultat exploitable. Un catalogue non configuré peut répondre
200 avec `available: false`. Aucun échec fournisseur n’empêche la saisie manuelle.

## 7. Scénarios de recette à automatiser et à jouer

Fixtures exclusivement fictives : un admin non inscrit, un organisateur, un présentateur, deux
participants et un membre extérieur. Tester aussi les cumuls, dont organisateur-présentateur.

| ID  | Scénario                                                      | Résultat attendu                                                                                |
| --- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| R01 | Première utilisation                                          | Aucune donnée GOTY importée ; création autorisée à l’admin                                      |
| R02 | Session absente, révoquée, membre hors édition active         | 401, 403, 403 ; aucune donnée privée                                                            |
| R03 | Création et année en double                                   | 14 rubriques initiales, auteur organisateur-présentateur ; doublon 409                          |
| R04 | Attribution de rôles par participant ou présentateur          | Refus ; organisateur peut désigner présentateur, seul admin change organisateurs                |
| R05 | Retrait avec jeux / ajout en préparation / ajout en soirée    | Retrait refusé ; ajout autorisé sans recalcul des catégories ; ajout refusé en soirée           |
| R06 | Six inscrits, proposition à quatre puis cinq votes            | Non adoptée à quatre ; adoptée à cinq ; aucune voix implicite du proposant                      |
| R07 | Ajout direct / nom équivalent après normalisation             | Autorisé seulement à l’organisation en préparation ; doublon refusé sans mutation               |
| R08 | Import CSV/XLSX, mapping et lot contenant une ligne invalide  | Aperçu correct ; aucun ajout partiel ; titres doublons conservés explicitement                  |
| R09 | Modification du jeu d’autrui ou référence à une autre édition | Refus ; propriétaire et données inchangés                                                       |
| R10 | Top de trois jeux / top avec trou / jeu répété / cumul prix   | Révélations à partir de Top 3 ; trou bloquant à annonce ; répétition refusée ; cumul autorisé   |
| R11 | Choix ou musique secret lus par chaque rôle et par la TV      | Auteur seul dans la vue membre ; rien dans la projection TV ou les autres vues                  |
| R12 | Choix modifié après pronostic puis annoncé                    | Pronostic conservé ; choix figé ; score calculé sur la réponse révélée                          |
| R13 | Pronostic sur soi / mauvais propriétaire / cible sans choix   | Refus des deux premiers ; cible absente neutralisée à annonce sans point                        |
| R14 | Première annonce et ajout de jeu ou participant simultanés    | Ordre sérialisé ; aucun ajout accepté après le gel                                              |
| R15 | Fermeture et pronostic simultanés                             | Pronostic enregistré avant fermeture ou refusé après ; aucun état intermédiaire                 |
| R16 | Double clic de révélation, retry et deux télécommandes        | Une seule nouvelle révélation avec la même version ; conflit pour la seconde commande           |
| R17 | Réouverture avant / après première révélation                 | Autorisée avant ; refusée après ; aucun choix ne redevient modifiable                           |
| R18 | Rubrique vide / suivante avant récapitulatif                  | Récapitulatif possible après fermeture ; annonce suivante refusée tant que précédente active    |
| R19 | Lecture simultanée à une révélation                           | Compteurs, choix, pronostics visibles et scores correspondent à une version cohérente           |
| R20 | Bon pronostic, mauvais pronostic et ex æquo                   | 1, 0 point ; rangs `1, 1, 3` ; aucun point pour précision ou musique                            |
| R21 | Classement demandé deux fois puis reprise                     | Retour au bon écran précédent, sans perdre la progression                                       |
| R22 | Retour en préparation                                         | Confirmation ; statuts/tirages/points remis à zéro, jeux/choix/pronostics conservés             |
| R23 | Clôture prématurée puis complète                              | Refus avant toutes rubriques `done` ; ensuite toutes écritures refusées, même admin             |
| R24 | Archive consultée par membre extérieur et visiteur anonyme    | Accès membre autorisé ; visiteur refusé ; réponses neutralisées d’autrui toujours privées       |
| R25 | Bande-son, choix suivant, trailer, son bloqué par navigateur  | TV seule tente la lecture ; arrêt correct, clic de reprise possible, musique portail suspendue  |
| R26 | Changement d’édition, déconnexion et réponse réseau tardive   | Aucun mélange entre éditions ou utilisateurs ; reprise sur dernière version                     |
| R27 | IGDB absent ou indisponible, vidéo non intégrable             | Saisie manuelle possible et secours vidéo ; aucun secret fournisseur transmis                   |
| R28 | Réordonner : rubrique commencée ou permutation invalide       | Refus atomique ; seules rubriques à venir déplaçables                                           |
| R29 | Comptes cumulant admin/participant/organisateur/présentateur  | Union des droits de gestion, confidentialité inchangée                                          |
| R30 | Parcours complet sur deux téléphones et une TV                | Préparation, pronostics, révélations et archives cohérents ; synchronisation sous cinq secondes |

R01 à R29 alimentent les tests unitaires, d’intégration PostgreSQL et d’accès HTTP selon leur
nature ; R25, R26 et R30 nécessitent aussi une recette navigateur. Ne pas porter les tests de
mots de passe, sessions MariaDB et uploads d’avatars de la source ; vérifier à leur place les
contrôles d’identité Potopia. L’exécution locale et les validations encore ouvertes sont
consignées dans le [bilan du lot 7](RECETTE_GOTY_PARTY.md).

Retrait temporaire : `GOTY_ENABLED=false` ferme les accès métier et pages en 404 après contrôle
de session et masque les entrées du registre/admin, sans mutation des données. Réactivation
= mêmes éditions, versions et archives. Les confirmations de préparation, retrait d’un jeu,
redémarrage et clôture passent par le dialogue du portail ; annulation = aucune commande.
Une confirmation conserve la version proposée à son ouverture, un état serveur devenu différent
doit donc produire le conflit prévu, sans relance automatique.

## 8. Écarts arbitrés pour le portage

| Sujet comparé                                                    | Cible et justification                                                                                                                |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Comptes locaux décrits dans le cahier des charges                | Identité Discord et droits `core` ; suppression du parcours Mon compte GOTY et de la gestion des mots de passe                        |
| Création d’édition, rôle organisateur lié à une édition          | Reprendre le comportement source : admin ou organisateur déjà désigné peut créer ; création automatiquement organisateur-présentateur |
| Rôles de présentation modifiables durant la soirée               | Reprendre le comportement des routes/tests ; participants figés, rôles modifiables jusqu’à clôture                                    |
| Ajout de prix normalisé et propositions initiales                | Appliquer la même unicité normalisée aux deux parcours ; éviter des prix identiques dans le conducteur                                |
| Import annoncé sans gestion d’erreurs dans le cahier des charges | Prévisualisation et validation atomique, cohérentes avec l’API source ; pas de dédoublonnage automatique                              |
| TV et vue personnelle                                            | Contrat de présentation distinct pour que l’identité connectée ne modifie pas ce que l’écran collectif reçoit                         |
| Doubles commandes et cohérence des lectures                      | Version attendue et lecture cohérente adaptées au portage PostgreSQL et à plusieurs clients                                           |
| Ordre de récapitulation et lecture audio                         | Préconditions explicites conservées ; arrêt de l’audio lors d’un changement d’écran ou de choix                                       |
| Nouveau départ et audience des archives                          | Décisions utilisateur confirmées ; aucun outil de migration de données nécessaire au premier périmètre                                |

## 9. Critère de clôture du lot 1

Livrables documentaires : règles ci-dessus, matrice des droits, transitions, projections HTTP,
écarts et scénarios R01 à R30. Les deux décisions structurantes ont reçu une réponse explicite.
Le lot 2 peut commencer par le schéma et les tests métier, sans dépendre d’une reprise de données.
Toute modification ultérieure d’une règle de score, de visibilité ou de rôle doit mettre à jour
ce contrat et les scénarios correspondants avant son implémentation.
