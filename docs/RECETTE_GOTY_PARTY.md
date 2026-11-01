# Recette finale GOTY Party

Recette technique locale du **1er novembre 2026**, branche `feat/goty-party`.
Ce document distingue les contrôles exécutés des validations encore nécessaires avant
mise en service. Aucun accès à la base, au stockage ou aux comptes de production.

## Périmètre et environnement

PostgreSQL 17.11 (`postgres:17-alpine`) et RustFS 1.0.3, comme dans la CI et le compose du
projet. Services Docker créés sous un projet de recette distinct, avec ports et volumes dédiés.
Bases séparées pour les tests destructifs, le navigateur, la source de sauvegarde et sa restauration.
Les données sont fictives ; Discord est simulé pour les tests et les sessions de recette locale.
Les scripts de préparation, dumps, empreintes détaillées et objets restent hors Git dans `.cache`.

Les scénarios de référence sont [R01 à R30](CONTRAT_FONCTIONNEL_GOTY_PARTY.md).

| Scénarios           | Vérification exécutée                                                                                          | Preuve dans le dépôt                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| R01–R05             | Création, inscriptions, rôles cumulés, retrait, ajout et gel                                                   | `games/goty/test/editions.test.ts`, `preparation.test.ts`, `apps/web/test/access.test.ts`             |
| R06–R10             | Seuil de votes, normalisation, imports CSV/XLSX, propriété, top atomique et gel                                | `preparation.test.ts`, `imports.test.ts`, `top.test.ts`, `rules.test.ts`                              |
| R11–R19             | Secrets selon rôle/TV, pronostics, versions, concurrence et snapshot cohérent                                  | `snapshot.test.ts`, `ceremony.test.ts`, `apps/web/test/goty-http.test.ts`                             |
| R20–R24             | Score, ex æquo, reprise, retour en préparation, clôture et archives                                            | `rules.test.ts`, `ceremony.test.ts`, `snapshot.test.ts`                                               |
| R25–R27             | Volume avant lecture, arrêt/démontage, reprise ciblée, réseau tardif, compte changé, catalogue absent/en panne | `media.test.tsx`, `media-focus.test.ts`, `sync.test.tsx`, `catalog.test.ts` ; médias externes simulés |
| R28–R29             | Conducteur versionné, union des rôles et confidentialité inchangée                                             | `ceremony.test.ts`, `snapshot.test.ts`, `editions.test.ts`                                            |
| R30, partie serveur | Édition HTTP complète sur plusieurs sessions, de catégories à archives                                         | `apps/web/test/goty-http.test.ts` ; ne remplace pas deux téléphones et une TV réels                   |

La recette HTTP ajoutée au lot 7 joue les 14 rubriques initiales et une proposition adoptée :
imports prévisualisés puis confirmés, tops, prix et bande-son, pronostics bon/mauvais,
révélations, rubrique vide, double commande concurrente, classement et clôture. Elle vérifie
à chaque étape que la TV ne reçoit que les choix révélés et les jeux correspondants. Un membre
hors édition est refusé avant clôture et peut lire les archives ensuite. Session supprimée =
401, nouvelle connexion = accès rétabli. Notifications sans contenu secret et absence d’activité
publique sont contrôlées.

## Retrait temporaire et confirmations

`GOTY_ENABLED=false` masque la tuile et le lien d’administration, puis ferme les pages et services
GOTY (404 après contrôle de session). La valeur absente ou `true` active le module ; toute autre
valeur le désactive. Réglage serveur, relayé par Turbo, nécessitant redémarrage/redéploiement.
Il ne révoque aucune identité et ne modifie aucun choix, notification ou archive. Les requêtes
déjà engagées et les anciens déploiements doivent être arrêtés lors d’un retrait opérationnel.

Tests : retrait pour les deux rôles du portail, pages/API inaccessibles, réactivation puis mêmes
version et archives, sans notification supplémentaire. Les fonctions métier qui accèdent aux
données passent aussi par le contrôle ; les fonctions pures de règles/import ne sont pas affectées.

La recette navigateur a révélé un blocage des confirmations natives dans le navigateur intégré.
Les confirmations GOTY utilisent désormais le dialogue du portail : préparation, retrait de jeu,
retour en préparation et clôture. L’action garde la version présentée à l’ouverture, même si
le polling avance ; le serveur peut donc refuser une confirmation périmée. Les tests DOM vérifient
annulation, désactivation, conservation de la commande et protection contre le double clic.

## Sauvegarde et restauration vérifiées

Fixture dédiée contenant une édition clôturée avec score, une édition en préparation avec
choix privé, profils, notifications et avatar. Sauvegarde complète avec `pg_dump --format=custom`,
puis `pg_restore --exit-on-error --no-owner --no-acl` dans une base neuve vide ; outils PostgreSQL
17.11 exécutés dans le conteneur de recette. Aucun `--clean`, aucune restauration sur la source.

- Les **33 tables et 70 lignes** (tous domaines et historique Prisma inclus) ont la même empreinte
  de contenu après restauration, calculée sur les lignes JSON triées par table.
- Les projections archive pour un non-participant, TV et préparation privée sont identiques.
- La clé d’avatar restaurée correspond au même objet, recopié dans un bucket privé distinct :
  **42 089 octets**, SHA-256 identique, type `image/png`, accès non signé refusé avec **403**.
- Le dump a une empreinte SHA-256 enregistrée avec les artefacts locaux. Aucun média IGDB ou
  YouTube n’est recopié. Aucun secret d’environnement n’est inclus dans Git.

Cela valide le mécanisme sur une sauvegarde fictive. La politique de rétention, la sauvegarde
réelle de l’environnement cible et son point de reprise restent à confirmer par l’exploitant.
Le [guide d’exploitation](EXPLOITATION_GOTY_PARTY.md) donne les procédures à suivre.

## Contrôles du dépôt

La branche intègre aussi `origin/main` au commit `fa6fb21` (thèmes JoJo/Apothicaire et cartes).
Le conflit d’exports de `packages/ui/src/index.ts` a été résolu en conservant les nouveaux exports
de `main`, dont `ROAD_ROLLER_EVENT`, et `claimMediaFocus` de GOTY. Les réglages des médias statiques
et le mock des polices de `main` sont conservés avec les ajouts GOTY. Les contrôles sont exécutés
sur ce résultat fusionné avant publication de la branche. Cette validation a aussi révélé que le
tirage initial d’avatar pouvait sélectionner un élément verrouillé : il ne sélectionne désormais
que les éléments libres, avec un test de régression couvrant les parties obligatoires et optionnelles.

Contrôles locaux : formatage, ESLint, TypeScript, frontières, suite globale sans cache puis build
de production sans migration (`VERCEL_ENV` absent). PostgreSQL et RustFS réels, aucune clé
Discord/IGDB de production. Le test de signature S3 passe avec RustFS : la limitation S3rver
signalée aux lots 5 et 6 est levée pour cette recette.

| Contrôle                                 | Résultat local                                                                    |
| ---------------------------------------- | --------------------------------------------------------------------------------- |
| `format:check`                           | Réussi                                                                            |
| `lint`                                   | 17 tâches réussies                                                                |
| `typecheck`                              | 17 tâches réussies                                                                |
| `check:boundaries`                       | 8 modules, frontières respectées                                                  |
| `turbo run test --force --concurrency=1` | **516 tests réussis**, 13 packages testés, aucun résultat de test repris du cache |
| `build`                                  | Réussi ; aucune migration de production exécutée                                  |

Le workflow `.github/workflows/ci.yml` exécute ces mêmes contrôles sur chaque PR vers `main`.
Une exécution locale verte n’est pas une check GitHub verte : celle de la PR reste à obtenir
après autorisation de publication de la branche.

## Validation navigateur et portes de mise en service

Après fermeture de l’ancien onglet bloqué, la répétition a été reprise sur les données fictives
conservées. Parcours navigateur exécuté jusqu’à la clôture et aux archives : votes sur deux
comptes, proposition adoptée, annulation puis confirmation de la préparation, deux tops,
prix et bande-son, pronostic correct, quinze rubriques avec révélations et rubriques vides,
classement temporaire/reprise, confirmation d’archivage et consultation par un non-participant.
Le classement final donne un point au bon pronostic et les archives détaillent sa cible révélée.

Deux onglets visibles (télécommande et TV) ont été utilisés sans rechargement de la TV pendant
les mesures : annonce reçue en **903 ms**, révélation reçue en **1 861 ms**, sous cinq secondes
dans cet environnement local. Ces mesures ponctuelles ne garantissent pas le réseau de la soirée.
L’activation TV charge un lecteur YouTube réel ; lecture observée, arrêt distant = zéro iframe,
relance = une seule iframe, récapitulatif = lecteur démonté. Le secours d’un trailer absent
affiche son message et un lien de recherche YouTube. Aucune vidéo n’a été copiée dans le stockage du portail.

Archives et comparaison vérifiées à **390 × 844 px**, sans débordement horizontal du document
(375 px de contenu hors barre de défilement). Le plein écran n’a pas pu être confirmé dans le
navigateur intégré : vérifier son activation, le rendu et l’audio sur la TV réelle. Les comptes
ont été alternés dans le navigateur ; les deux téléphones physiques simultanés restent une
validation distincte. Les captures fictives de recette restent dans `.cache`, hors Git.

- [x] Cycle complet multi-session testé en HTTP, contrôles de confidentialité et concurrence.
- [x] Restauration PostgreSQL et objet privé vérifiés sur environnement isolé fictif.
- [x] Retrait/réactivation sans perte de données et confirmations testés.
- [x] Répétition navigateur complète jusqu’aux archives, confirmations visuelles, lecture YouTube
      réelle, secours vidéo, comparaison mobile et propagation TV mesurée sous cinq secondes.
- [ ] Deux téléphones et une TV physiques simultanés, plein écran, rendu et son vérifiés sur
      le matériel et le réseau de la soirée (complément terrain R25/R26/R30).
- [ ] Acceptation utilisateur de cette recette et sauvegarde réelle de la cible confirmées.
- [ ] Publication de branche/PR autorisée, check GitHub `ci` verte.
- [ ] Fusion et déploiement explicitement autorisés, puis contrôle des accès et première édition.

**Verdict : préparation technique locale réalisée ; mise en service non autorisée et lot 7
non clôturé tant que ces portes restent ouvertes.** Ne pas importer la fixture dans l’environnement
cible. Les migrations GOTY des lots 2 et 3 sont additives ; ce lot n’ajoute aucune migration.
