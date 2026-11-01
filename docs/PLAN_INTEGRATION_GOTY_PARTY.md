# Plan d’intégration de GOTY Party dans Potopia

Statut : lots 1 à 5 terminés ; exploitation et recette finale aux lots 6 et 7. Analyse des dépôts le
31 octobre 2026. Ce document ne déclenche ni migration ni déploiement.

Le [contrat fonctionnel](CONTRAT_FONCTIONNEL_GOTY_PARTY.md) détaille les droits, transitions,
contrats HTTP et scénarios de recette. Décisions utilisateur : départ à zéro et archives
accessibles à tous les membres de Potopia. La reprise facultative décrite plus bas n’est donc
pas retenue pour le premier périmètre.

## 1. Objectif et approche recommandée

Intégrer GOTY Party comme une app du portail : les membres préparent leur palmarès annuel,
proposent des catégories et pronostiquent les réponses des autres ; un présentateur anime une
cérémonie avec révélations progressives, classement et écran de télévision.

Recommandation : créer `games/goty` (`@app/goty`) et le schéma PostgreSQL `goty`, avec une
interface React intégrée à Next. Utiliser les comptes Discord, les composants et les services
communs de Potopia. Cette approche demande un portage initial, mais conserve un seul système
d’authentification, une seule base applicative et un seul circuit de déploiement.

Un simple lien vers l’app actuelle peut servir de transition. Une iframe ou la conservation
durable de Vue/Express/MariaDB imposerait deux systèmes de comptes, de droits et d’exploitation ;
ce n’est pas la cible proposée.

Le plan conserve les fonctionnalités actuelles avant d’ajouter des liens avec la monnaie ou
l’inventaire. Aucun gain de PotoCoins n’est prévu dans le premier périmètre.

## 2. Ce que les sources permettent de réutiliser

| Source dans goty-party                          | Traitement dans Potopia                                                                         |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `apps/api/src/domain.ts` et ses tests           | Reprendre les règles pures, adapter les types d’identifiants et les erreurs                     |
| `apps/api/src/routes.ts`                        | Extraire les règles des handlers dans des services métier testables                             |
| `apps/api/src/editions.ts`                      | Porter les droits, transactions et projections de données vers Prisma/PostgreSQL                |
| Migrations Knex                                 | Utiliser comme référence pour de nouvelles migrations Prisma ; ne pas les exécuter dans Potopia |
| `apps/api/src/catalog.ts`                       | Adapter l’intégration IGDB, les délais, le cache et les limites de requêtes                     |
| Vues et composants Vue                          | Refaire en React en conservant les parcours et les comportements                                |
| Imports et fonctions de présentation TypeScript | Reprendre ce qui ne dépend pas de Vue et adapter les tests                                      |
| Authentification et gestion locale des comptes  | Remplacer par Better Auth/Discord et les services `core`                                        |
| Avatars envoyés sur disque                      | Utiliser l’identité du portail ; reprise des anciens portraits hors périmètre par défaut        |
| Docker/Nginx/Caddy et sauvegardes MariaDB       | Remplacer par le circuit d’exploitation de Potopia                                              |

Les sources de référence sont le README et le cahier des charges de goty-party, les migrations,
les services et les tests des deux projets. La base et les médias locaux n’ont pas été inspectés :
leur volume et la nécessité de leur reprise restent à établir. Les exemples personnels du dépôt
source ne doivent pas être recopiés dans le dépôt public de Potopia.

## 3. Décisions à fixer au début

| Sujet                        | Proposition de départ                                                                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Identité                     | Compte Discord de Potopia ; aucun second mot de passe                                                                 |
| Participation                | Inscription explicite par édition ; être membre du portail ne donne pas accès à une édition active                    |
| Organisation et présentation | Rôles propres à chaque édition, cumulables avec la participation                                                      |
| Administration               | Les admins Potopia conservent les pouvoirs de gestion prévus par la source, sans accès aux réponses secrètes d’autrui |
| Archives                     | Éditions clôturées consultables par tous les membres du portail, comme dans la source pour les utilisateurs connectés |
| Données de départ            | Nouvelle base GOTY vide ; reprise de l’existant uniquement si demandée                                                |
| Visuel                       | Conserver la personnalité GOTY Party dans les composants et thèmes du portail                                         |
| Synchronisation              | Requêtes périodiques pendant la cérémonie ; serveur temps réel reporté                                                |
| Écran TV                     | Route authentifiée dédiée ; aucun lien public donnant accès aux données privées                                       |

La reprise de données et la politique d’archives sont confirmées dans le contrat fonctionnel.
Les autres propositions y sont précisées pour servir de base à la première version.

## 4. Architecture cible

```text
games/goty/
  schema.prisma
  src/          règles, éditions, accès, jeux, catégories, choix, pronostics, cérémonie, catalogue
  ui/           composants React, client HTTP, état de l’édition, styles limités à l’app
  test/         règles, droits, concurrence, confidentialité et cycle complet
  README.md
apps/web/
  app/(platform)/goty/                         accueil et éditions
  app/(platform)/goty/[editionId]/...          jeux, palmarès, catégories, pronostics, cérémonie
  app/(platform)/admin/goty/...                administration globale
  app/api/goty/...                            handlers fins, validation et accès
```

Prévoir un layout authentifié spécifique pour `/goty/[editionId]/tv`, sans navigation encombrante,
en dehors du groupe qui impose le cadre du portail si nécessaire. La gestion d’une édition par
un organisateur non admin reste sous `/goty/...`, pas derrière le layout global réservé aux admins.

Chaque écriture métier accepte `{ tx?: DbTx }`. Le module ne lit que ses tables ; les identités
sont obtenues via `@app/core`. Les références `userId` sont des chaînes sans FK vers `core`.
Les relations internes à `goty` restent possibles. Aucun import Next dans `games/goty`.

Prévoir les modèles `GotyEdition`, `GotyMember`, `GotyRound`, `GotyGame`, `GotyChoice`,
`GotyPrediction`, `GotyProposal` et `GotyVote`. Conserver année unique, version d’édition,
état de l’écran, ordre de révélation et compteurs. Définir explicitement les contraintes uniques,
index, phases, statuts et règles de suppression ; aucune table de comptes ou de sessions GOTY.

## 5. Réalisation par lots et critères de fin

### Lot 1 — Figer le contrat fonctionnel ✅

- Relever les parcours et les règles dans le code et les tests source ; résoudre tout écart avec
  le cahier des charges avant portage.
- Écrire une matrice des droits : membre hors édition, participant, organisateur, présentateur,
  admin ; distinguer les rôles seuls et leurs cumuls.
- Figer les transitions `categories → preparation → live → closed`, les statuts de rubrique
  `draft → announced → locked → revealing → done` et les retours autorisés.
- Établir les contrats des réponses HTTP, notamment les champs visibles selon l’utilisateur.

**Fini quand :** les comportements attendus et les scénarios de recette sont écrits, avec un
choix explicite sur les données existantes.

Livré : [contrat fonctionnel](CONTRAT_FONCTIONNEL_GOTY_PARTY.md), avec matrice des droits,
transitions, projections par lecteur, adaptations de la source et scénarios R01 à R30.

### Lot 2 — Créer le module et les données ✅

- Ajouter le package, le schéma à l’assemblage Prisma, la migration additive et les configurations
  TypeScript, ESLint et Vitest suivant les modules existants.
- Porter les fonctions pures : catégories initiales, seuil de vote à 75 %, mélange, classement
  avec ex æquo, validation YouTube et ouverture des pronostics.
- Créer les services d’accès, les éditions et les participants en s’appuyant sur les utilisateurs
  fournis par `core` ; n’importer ni comptes ni sessions depuis l’ancien projet.

**Fini quand :** la migration s’applique sur la base de test, les règles passent et le contrôle
des frontières accepte le nouveau module.

Livré : [module serveur `@app/goty`](../games/goty/README.md), huit tables dans le schéma `goty`,
migration additive, règles pures, services d’accès, création d’édition et gestion des inscrits.
Les tests vérifient les rôles, les archives, la concurrence et les transactions composables.
Aucune route ou interface GOTY n’est encore exposée dans le portail.

### Lot 3 — Porter la préparation ✅

- Gérer les propositions et votes, les catégories de base, le passage en préparation et l’ajout
  de rubriques pendant cette phase selon les règles existantes.
- Porter les listes personnelles de jeux, les imports CSV/XLSX et leur prévisualisation.
- Porter le top personnel, les prix, les précisions et les liens YouTube de bande-son.
- Préserver les contrôles de propriétaire, d’édition, de phase et le gel des choix à l’annonce.
- Adapter IGDB : secrets côté serveur, fonctionnement sans clés, recherche bornée, délais réseau,
  erreurs lisibles et cache adapté à plusieurs instances. Documenter les variables réellement
  retenues dans `.env.example` et `turbo.json`.

**Fini quand :** deux participants peuvent préparer leur édition sans consulter les choix secrets
de l’autre ; un import invalide ne produit pas d’écriture partielle non annoncée.

Livré côté serveur : catégories, votes, ouverture en préparation, jeux, imports CSV/XLSX et
aperçus réutilisables, choix personnels, IGDB avec cache et quotas PostgreSQL partagés. Les
interfaces React restent au lot 5 ; voir le [README du module](../games/goty/README.md).

### Lot 4 — Porter les pronostics et la cérémonie ✅

- Reprendre les pronostics et le score actuel : un point par réponse correcte révélée, ex æquo
  conservés ; aucune conversion automatique en monnaie.
- Porter annonce, fermeture et réouverture des pronostics, révélation individuelle,
  récapitulatif, classement temporaire, reprise, redémarrage, lecture/arrêt audio et clôture.
- Conserver un verrou de ligne sur l’édition pour sérialiser les écritures concurrentes.
- Ajouter une version attendue aux commandes de présentation afin qu’un double clic ou une
  requête rejouée ne révèle pas deux réponses ; renvoyer un conflit et rafraîchir l’état.
- Construire les réponses depuis une vue transactionnelle cohérente : vérifier le niveau
  d’isolation PostgreSQL, car une transaction seule ne garantit pas un snapshot constant.
- Ne jamais transmettre les choix cachés, l’ordre futur de révélation ou les pronostics privés,
  même aux admins et présentateurs. Exposer uniquement les informations de progression prévues.
- Clôturer en lecture seule ; conserver les restrictions de visibilité des pronostics non
  concernés par une réponse révélée, conformément au comportement source.

**Fini quand :** le cycle complet passe en tests avec plusieurs acteurs, y compris une course
entre enregistrement d’un pronostic, fermeture et révélation.

Livré côté serveur : pronostics, score dérivé avec ex æquo, commandes versionnées, conducteur,
état audio, retour en préparation et archives. Les vues membre/TV sont filtrées côté serveur et
lues sous un verrou partagé cohérent avec les écritures. Le cycle complet et les courses sont
testés sur PostgreSQL. Aucune migration nouvelle ; interfaces et handlers restent au lot 5.

### Lot 5 — Intégrer l’interface au portail ✅

- Refaire en React l’accueil, la sélection d’édition, les jeux, les catégories, le palmarès,
  les pronostics, l’organisation, la cérémonie et les archives.
- Ajouter la tuile GOTY Party dans le registre, les routes et les tests d’accès web, les styles
  Tailwind et les exports du package. Utiliser `AppLink`/`useNavigate` dans l’UI partagée.
- Conserver le réordonnancement des rubriques et des choix avec une solution accessible,
  utilisable aussi au clavier et sur mobile.
- Réinitialiser l’état lors d’un changement d’utilisateur ou d’édition et ignorer les réponses
  réseau devenues obsolètes, comme le fait le store actuel.
- Synchroniser la cérémonie par polling, avec arrêt hors écran, reprise au retour et comparaison
  de version ; limiter le coût en n’envoyant un snapshot complet que lorsque nécessaire.
- Prévoir activation manuelle de l’audio sur la TV, plein écran, reconnexion et absence de
  doublons audio ; suspendre la musique du portail pendant les médias GOTY.
- Désactiver la mise en cache partagée des réponses privées ; vérifier aussi les mécanismes de
  cache Next. Pour les mutations HTTP, contrôler l’origine et appliquer les protections CSRF
  appropriées : les handlers personnalisés ne sont pas protégés par la seule présence de Better Auth.

**Fini quand :** un essai sur deux comptes et un écran TV permet d’animer la soirée, sur mobile
et grand écran, sans révélation anticipée ni conflit de navigation ou de musique.

Livré : tuile membre, administration, pages React de préparation, pronostics, cérémonie et
archives, API authentifiée avec contrôle d’origine et écran TV séparé. Polling à trois secondes,
réponses conditionnelles privées, protection contre les réponses tardives et changements de
compte, top atomique et conducteur réordonnables au clavier. Médias avec activation TV manuelle
et suspension de la musique du portail. Recette locale sur comptes fictifs, top, pronostic,
télécommande et TV, avec contrôle mobile à 390 px. Les tests métier, HTTP et DOM complètent
cette recette ; la recette exhaustive de production reste au lot 7. Voir les limites de
validation dans le [README du module](../games/goty/README.md).

### Lot 6 — Relier les services communs et préparer l’exploitation

- Ajouter des notifications ciblées pour les étapes utiles, sans titre de jeu ni réponse secrète.
  Publier éventuellement la fin d’édition dans l’activité, après validation du contenu public.
- Réutiliser les profils du portail. Si des médias privés supplémentaires sont retenus, utiliser
  R2 privé, des clés serveur et des URLs présignées après contrôle d’accès, jamais le disque local.
- Valider le comportement des jaquettes et vidéos externes ; vérifier les conditions des
  fournisseurs au moment de l’implémentation avant de choisir leur cache ou leur redistribution.
- Documenter installation, variables, sauvegarde/restauration PostgreSQL et stockage, diagnostic
  d’une cérémonie et procédure de bascule. Exclure les scripts de démonstration personnels.

**Fini quand :** la documentation permet d’installer et d’exploiter le module sans MariaDB,
Express ni le déploiement historique de GOTY Party.

### Lot 7 — Recette et mise en service

- Jouer une édition fictive complète : catégories, préparation, pronostics, cérémonie, archives.
- Tester rôles cumulés, membre exclu de l’édition, session révoquée, reprise après déconnexion,
  réponses réseau retardées, commandes simultanées et indisponibilité d’IGDB.
- Vérifier confidentialité dans les réponses JSON, URLs de médias, caches, logs, activité et
  notifications ; les boutons masqués ne constituent pas un contrôle d’accès.
- Passer `format:check`, `lint`, `typecheck`, `check:boundaries`, `test` puis `build`.
- Mettre à jour README, architecture, roadmap et README du module dans les PR concernées.
- Effectuer une répétition générale avant la première soirée et vérifier une restauration sur
  un environnement isolé. Préparer le retrait de la tuile en cas de problème et conserver les
  données ; une baisse de version du code ne doit pas supposer l’annulation des migrations.

**Fini quand :** recette acceptée, CI verte, sauvegarde vérifiée et déploiement autorisé.
Chaque lot peut donner lieu à une PR ; garder le module non référencé dans le registre jusqu’à
ce que son parcours soit utilisable. Les fusions déclenchent le déploiement et les migrations
de production selon les règles du dépôt.

## 6. Reprise facultative des données existantes

Si elle est souhaitée, la préparer avant la mise en service, après stabilisation du schéma :

1. Faire une sauvegarde cohérente de MariaDB et des fichiers ; travailler sur une copie.
2. Construire une correspondance explicite entre anciens comptes et utilisateurs Potopia.
   Ne jamais déduire une identité d’un simple pseudo ; bloquer les comptes non rapprochés.
3. Transformer les données vers le schéma GOTY en conservant les relations. Remapper aussi les
   identifiants présents dans le JSON : ordre de révélation, état de l’écran et références audio.
4. Ne transférer ni mots de passe ni sessions ; traiter les anciens avatars séparément uniquement
   si leur conservation est décidée.
5. Exécuter un import à blanc, puis comparer comptes de lignes, phases, révélations, classements
   et accès. Produire un rapport sans données privées dans le dépôt.
6. Geler les écritures de l’app source, refaire l’export final, importer et vérifier avant ouverture.
   Prévoir un import idempotent ou une détection stricte des doublons.
7. Garder l’app source sauvegardée jusqu’à validation. En cas de retour, arrêter les nouvelles
   écritures et rapprocher les changements faits après bascule avant de rouvrir l’ancien service.

Les exports, correspondances et données réelles restent hors Git. Toute opération qui remplace
des données existantes nécessite une validation explicite de sa cible et de son effet.

## 7. Priorités et premier livrable

Ordre proposé : contrat fonctionnel → module et données → préparation → cérémonie → interface
complète → exploitation → recette et bascule. L’interface peut être portée progressivement au
fur et à mesure des services pour permettre des essais sans attendre la fin.

Premier livrable concret : une édition fictive créée par un admin, deux membres Discord inscrits,
une liste de jeux et un choix personnel par membre, avec un test prouvant que chacun ne reçoit
que son propre choix. Ce socle valide les identités, les frontières du module et la confidentialité
avant de porter le reste.

Le portage React et la cérémonie sont les lots les plus importants. Un chiffrage fiable viendra
après le lot 1, une fois le périmètre visuel et la reprise de données décidés.
