# Plan de développement

Les choix d'architecture et leurs raisons sont dans [ARCHITECTURE.md](ARCHITECTURE.md). Ce fichier
liste les étapes de réalisation dans l'ordre. Pour chacune : ce qu'on fait, ce qui est livré, et
comment on vérifie qu'elle est terminée.

Pour chaque étape, les critères de fin incluent toujours que `pnpm lint`, `pnpm typecheck`,
`pnpm test` et `pnpm build` passent depuis la racine.

---

## Étape 1 : init du monorepo ✅

**Tâches**

- git, pnpm workspaces (`apps/*`, `games/*`, `packages/*`), Turborepo.
- `packages/config` : tsconfig (`base`, `library`, `nextjs`), ESLint (`base`, et `library` qui
  interdit les imports Next), `brand.ts`.
- Prettier, `.editorconfig`, `.gitattributes` (LF), `.gitignore`.
- `.env.example` documenté, `docker-compose.yml` (Postgres 17 avec une base `app_test`).

**Fini quand**

- `pnpm install`, `lint`, `typecheck`, `build` et `format:check` passent.

---

## Étape 2 : `packages/db` ✅

**Tâches**

- Script `assemble.ts` : il copie les `schema.prisma` de `packages/*` et `games/*` dans
  `prisma/schema/` (dossier généré), à côté d'un `base.prisma` (generator et datasource
  multiSchema).
- `prisma.config.ts` : la migration utilise `DIRECT_URL`.
- Client partagé : `createDb(url)` avec `@prisma/adapter-pg` et un singleton `db`.
  - Exports : les types `Db` et `DbTx`, et `withTx(fn)`.
- Scripts : `db:generate`, `db:migrate` (dev), `db:deploy` (prod), `db:reset:test`.
- Migration initiale, avec les schémas Postgres `core`, `economy` et `ideas` déclarés vides pour
  l'instant.
- Helper de test : `resetTestDb()`, qui applique les migrations sur `TEST_DATABASE_URL` puis vide
  les tables.

**Livrables**

- `@app/db`, importable par les autres packages.
- Un `pnpm db:migrate` fonctionnel sur Docker local.

**Fini quand**

- Les migrations s'appliquent sur `app_test`.
- Un test Vitest « smoke » se connecte et exécute `SELECT 1`.

---

## Étape 3 : `packages/core` ✅

**3a. Schéma et données**

- `schema.prisma` (schéma `core`) : `User`, `Session` (+ `guildCheckedAt`), `Account`,
  `Verification`, `ActivityEvent`, `Notification`.
- Migration.

**3b. Auth**

- Config Better Auth : adapter Prisma, provider Discord (scopes `identify email guilds`), tokens
  OAuth chiffrés.
- `mapProfileToUser` : remplit `discordId`, le pseudo et l'avatar.
- Hook avant création de session :
  - vérifie l'appartenance au serveur `DISCORD_GUILD_ID` ;
  - refuse sinon (redirection vers `/refused`) ;
  - synchronise le `role` depuis `ADMIN_DISCORD_IDS`.
- `checkGuildMembership(accessToken)` : appel à `GET /users/@me/guilds`, avec gestion du refresh
  token.
- Revérification toutes les 6 h : si l'utilisateur n'est plus membre, sa session est révoquée.

**3c. Accès**

- `getSession(headers)`, `requireMember(headers)` (401 / 403) et `requireAdmin(headers)` (403).
- `isAdmin(discordId)`, qui lit l'env à chaque appel.
- Erreurs typées : `UnauthorizedError` et `ForbiddenError`.

**3d. Services**

- Users : `getUser`, `getUsersByIds`, `listUsers`.
- Registre des apps : type `AppEntry`, `apps` et `getVisibleApps(user)`.
- Activité : `publishEvent({ userId, app, type, payload }, { tx })` et `listRecentEvents(limit)`.
- Notifications :
  - `notify({ userId, title, link }, { tx })` et `notifyAdmins(...)` ;
  - `listNotifications`, `countUnread`, `markAsRead`, `markAllAsRead`.

**3e. UI** (`packages/core/ui`, React sans Next)

- `Header`, `NotificationBell`, `AppGrid`, `ActivityFeed`, `AccountPanel`.

**Tests**

- Un non-membre est refusé à la connexion.
- La session d'un ex-membre est révoquée à la revérification.
- `requireAdmin` refuse un non-admin.
- `getVisibleApps` filtre bien par rôle.
- `notify` puis `markAsRead` fonctionnent.
- `publishEvent` respecte la transaction passée en option.

**Fini quand**

- Tous les tests de core passent.
- L'API Discord est entièrement mockée dans les tests.

---

## Étape 4 : `packages/economy` ✅

**Tâches**

- `schema.prisma` (schéma `economy`) : `Wallet` et `Transaction`.
- Migration SQL complémentaire :
  - `CHECK (balance >= 0)` et `CHECK (amount <> 0)` ;
  - trigger qui bloque UPDATE et DELETE sur `transactions`.
- `credit()` et `debit()` : création du wallet si besoin, `FOR UPDATE`,
  `ON CONFLICT (idempotency_key) DO NOTHING`, mise à jour du solde et de `balanceAfter`. Ces
  fonctions acceptent `{ tx }`.
- Erreur typée `InsufficientFundsError`.
- `getBalance(userId)` et `getHistory(userId, { limit, cursor })`.
- `adminAdjust({ actorId, userId, amount, reason })` : motif obligatoire, puis `credit` ou `debit`
  et `notify` au membre.
- UI : `BalanceCard`, `TransactionList`, `AdminAdjustForm`.

**Tests**

- Même `idempotencyKey` = un seul crédit, et le même résultat renvoyé.
- 20 débits concurrents sur un solde limité : aucun solde négatif, et le nombre de succès est
  cohérent.
- Après une série d'opérations aléatoires, la balance est égale à la somme du ledger.
- Un UPDATE ou un DELETE sur `transactions` lève une erreur.
- Un débit supérieur au solde est refusé et ne laisse aucune trace.

**Fini quand**

- Tous les tests passent sur le Postgres local, tests de concurrence compris.

---

## Étape 5 : `packages/storage` et `packages/ui` ✅

**storage**

- `createR2Client()`, à partir des variables `R2_*` (endpoint
  `https://<account>.r2.cloudflarestorage.com`).
- `presignPut({ key, contentType, contentLength, expiresIn })`.
- `presignGet({ key, expiresIn })` et `headObject(key)`.
- Aucune logique métier : les modules décident qui a le droit de faire quoi.

**ui**

- `theme.css` : variables CSS (`--bg`, `--surface`, `--border`, `--text`, `--muted`, `--accent`…),
  sombres par défaut et branchées sur Tailwind v4 via `@theme`.
- Primitives : `Button`, `Card`, `Input`, `Textarea`, `Select`, `Label`, `Badge`, `Avatar`,
  `Modal`/`Sheet` (menu mobile), `EmptyState`.

**Tests**

- storage : les URLs présignées contiennent le bon bucket, la bonne clé, le bon type et une
  expiration courte.

---

## Étape 6 : `apps/web` ✅

**Tâches**

- Next 16 + Tailwind v4, avec `transpilePackages` pour les packages `@app/*`, et la config ESLint
  de Next.
- `app/api/auth/[...all]` : handler Better Auth.
- `proxy.ts` : redirige vers `/login` s'il n'y a pas de cookie de session (contrôle optimiste
  seulement).
- Pages :
  - `/login` (bouton Discord), `/refused` ;
  - layout `(platform)`, qui exécute `requireMember()` et affiche le header (marque depuis
    `brand.ts`, cloche, avatar) ;
  - `/` : le dashboard.
    - Colonne gauche : compte, solde, menu (Accueil, Mon avatar, Mon inventaire, Ma monnaie,
      Administration pour les admins), puis le fil d'activité.
    - Centre : grille de tuiles, puis la place des avatars.
    - Header : marque, Sonic (marche, course, sprint ; Super Sonic avec les 7 Émeraudes du
      Chaos), Luffy (fruit du démon étincelant à l'arrêt ; au clic, il en sort avec sa musique et
      rebondit sur le liseré du header ; combo avec la boule, qu'il poursuit sur le liseré),
      boule musicale, thème, cloche, volume,
      menu du profil (Paramètres, déconnexion).
    - « Mon inventaire » (`/inventaire`) : les Émeraudes du Chaos cachées dans les pages (un
      clic sur une pierre trouvée : sursaut, éclats et note de cristal, jamais deux fois pareils),
      puis les hauts faits.
    - Défaite dans un jeu : arrêt sur image « To Be Continued » (JoJo), dès la défaite ; se coupe
      dans « Paramètres » (`/parametres`, menu de l'avatar), réglages gardés sur l'appareil.
    - Thème JoJo (Stardust Crusaders) : décor manga, portraits, « ゴゴゴ » ; le choisir déclenche
      ZA WARUDO, qui fige vraiment tout le site (animations et musiques) le temps de l'effet.
    - Thème One Piece : nuit sur la mer (houle, lune, Thousand Sunny et Vogue Merry, mouettes,
      chapeau de paille au vent, pavillon), l'équipage qui défile dans les coins, les avis de
      recherche de tout l'équipage, cadres translucides en corde tressée ; le choisir déclenche
      « ドン!! » et le Coup de Burst du Sunny.
    - Navigation sans rechargement entre les pages (tuiles, logo, notifications, jeux : `AppLink`
      et `useNavigate` de `@app/ui`) : la musique du header continue d'une page à l'autre.
    - Sur mobile, la colonne gauche passe dans un menu.
  - `/wallet` (« Ma monnaie ») : solde et historique paginé (20 par page) ;
  - `/admin` : accueil de l'administration ;
  - `/admin/economy` : liste des membres, crédit ou débit avec motif obligatoire, historique.
- Server actions : notifications (marquer comme lu) et ajustement admin de la monnaie. Chacune
  appelle `requireMember` ou `requireAdmin`.

**Tests**

- Chaque route handler et chaque server action refuse une requête sans session (401) et une session
  non membre (403).
- Les routes `/admin/*` refusent un membre non admin (403).

**Fini quand**

- On peut se connecter en local avec Discord, voir le dashboard, et créditer un membre depuis
  l'admin.

---

## Étape 7 : `packages/ideas` ✅

**Tâches**

- `schema.prisma` (schéma `ideas`) : `Idea` et `IdeaUpload`, avec la migration.
- Validation zod : longueurs maximales, rareté (enum), types d'image et taille de 3 Mo.
- `createUploadUrl(userId, { contentType, size })` :
  - au plus 30 demandes par heure glissante et par membre (advisory lock par membre), 429 au-delà ;
  - génère la clé `ideas/<uuid>.<ext>` ;
  - crée la ligne `IdeaUpload` et renvoie l'URL présignée PUT ;
  - purge au passage les uploads jamais utilisés de plus de 24 h (`purgeStaleUploads`).
- `submitIdea(userId, input)` (aucune limite d'envoi d'idées) :
  - si une image est jointe, avant la transaction : la clé doit appartenir à l'utilisateur et ne
    pas avoir servi, et l'objet (`HeadObject`) doit avoir la taille et le type annoncés ;
  - dans la transaction : l'upload est verrouillé, revérifié et marqué comme utilisé ;
  - création de l'idée, puis `publishEvent("ideas", "idea_submitted", {})` et
    `notifyAdmins("Nouvelle idée reçue")`.
  - Valeur de retour : `{ ok: true }` uniquement.
- Admin (lecteur en premier argument, `ForbiddenError` pour un non-admin) :
  `listIdeas(reader, { authorId?, rarity?, cursor })`, `getIdea(reader, id)`,
  `getIdeaImageUrl(reader, id)`, `listIdeaAuthorIds(reader)` et `exportIdeas(reader)` (export JSON,
  URLs d'image de 15 min) ; `countIdeas()` pour l'accueil de l'administration.
- Exception à la boîte noire : `getShowcaseIdea()` et `getShowcaseImageUrl()` pour l'idée exemple
  du vote des cartes (`SHOWCASE_IDEA_ID`).
- UI :
  - `IdeaForm` : upload direct vers R2, puis confirmation et formulaire vidé ;
  - `IdeasAdminList` avec filtres, liste chargée au défilement (`IdeasFeed`, bouton « Remonter »),
    et `IdeaDetail` ;
  - coller une image (Ctrl+V) dans le formulaire.
- Web :
  - pages `/ideas`, `/admin/ideas` et `/admin/ideas/[id]` (et `/admin/cartes`, étape 13) ;
  - routes `/api/ideas/upload-url`, `/api/admin/ideas/[id]/image` (redirection 302 vers une URL
    présignée GET) et `/api/admin/ideas/export` (fichier JSON, admin) ;
  - tuile « Boîte à idées » dans le registre.

**Tests**

- Un non-admin reçoit 403 sur `listIdeas`, `getIdea` et la route image.
- Validation : champs trop longs, rareté invalide, type d'image refusé, image trop grosse.
- Aucune limite d'envoi d'idées ; au-delà de 30 demandes d'envoi d'image dans l'heure, refus 429.
- Les uploads abandonnés de plus de 24 h sont purgés (objet et ligne).
- Une image dont le type ne correspond pas à celui annoncé est refusée.
- La clé R2 est toujours générée côté serveur : une clé fournie par le client, déjà utilisée ou
  appartenant à un autre utilisateur est refusée.
- L'événement d'activité ne contient ni titre ni contenu.

**Fini quand**

- Un membre envoie une idée avec une image, et seul l'admin la voit, image comprise.

---

## Étape 7b : intégration du jeu TROIS ✅

Le Wordle à 3 mots par jour, développé à part (repo `trois`, branche `main`), devient le premier
jeu du portail. Détails du jeu : [games/trois/README.md](../games/trois/README.md).

**Tâches**

- `games/trois` : schéma Postgres `trois` (`games`, `guesses`, `daily_words`, modèles préfixés
  `Trois`), tirage des mots, évaluation, partie, mode test, stats et classement.
- Identité du portail (Discord) à la place des comptes du jeu : plus de pseudo#tag, de cookie
  d'appareil, de code de connexion ni de système d'amis. Historique repris à zéro.
- Routes `/api/trois/{game,guess,practice,leaderboard}` (requireMember), page `/trois`, tuile du
  registre, événement `trois/day_completed` (score seulement) dans le fil d'activité.
- Pas de récompense en monnaie pour l'instant.

**Tests**

- Feedback des lettres, lettres en double comprises.
- Tirage : 3 mots distincts, identiques pour tous, tirages simultanés cohérents, pas de répétition.
- Partie : ordre des mots, réponse cachée tant que le mot n'est pas terminé, défaite au 6e essai,
  essais simultanés jamais comptés deux fois, refus après la journée.
- Mode test sans écriture, classement sans lettres, points de la semaine.
- Minuit : un essai pour la veille jamais compté pour le nouveau jour, délai de grâce (commencée
  avant minuit, jusqu'à 00h30, perdu si la nouvelle journée est commencée), journée finie après
  minuit comptée pour la veille, minuit de Paris en heure d'hiver et d'été.
- Historique du classement : jour passé (couleurs seulement), date future ramenée à aujourd'hui,
  semaine et mois passés entiers.
- Chaque route `/api/trois/*` et la page refusent sans session (401) et une session révoquée (403).

**Fini quand**

- Un membre joue les 3 mots du jour sur le portail et apparaît au classement et dans l'activité.

---

## Étape 8 : finitions ✅

**Tâches**

- Script `pnpm check:boundaries` : il lit les `.prisma` pour associer chaque modèle à son domaine,
  puis signale tout accès à un modèle d'un autre domaine (n'importe quel client et n'importe quelle
  méthode, destructuration, types `Prisma.<Modèle>…`), le SQL brut visant le schéma d'un autre
  module (avec ou sans guillemets) et tout import de `@app/db` dans `apps/*`.
- Seed fictif : quelques users inventés, des transactions et des événements. Décision : script
  local non versionné (`*.local.ts`, ignoré par git), qui passe par les fonctions des modules
  (`createFakeMember` de `@app/core/testing`, mots du jour via `@app/trois/testing`).
- CI GitHub Actions : install, format, lint, typecheck, check:boundaries, test (services Postgres
  et stockage S3) et build du site (sans migration).
- README :
  - lancer le projet ;
  - variables d'environnement ;
  - config Discord (Developer Portal, redirect URI) ;
  - config R2 (bucket privé, token API, CORS pour le PUT depuis le navigateur) ;
  - déploiement Vercel ;
  - ajouter une app au registre ;
  - utiliser `economy`, `publishEvent` et `notify` depuis une app.
- Vérification finale : aucun secret ni contenu réel dans le repo.

**Fini quand**

- La CI est verte.
- Quelqu'un qui découvre le projet peut le lancer en suivant uniquement le README.

---

## Étape 9 : avatars et place ✅

Détails : section « Avatars et place » de [ARCHITECTURE.md](ARCHITECTURE.md).

**Tâches**

- `scripts/import-lpc.ts` (`pnpm assets:import`) : clone partiel du repo LPC épinglé sur un
  commit, sélection des éléments (15 catégories, 5 animations, homme et femme, capes avec animations de remplacement), rapport
  des éléments écartés, sortie dans `packages/avatar-assets` (PNG, catalogue, palettes, crédits).
- `packages/avatar` : config et validation (`checkConfig`), compositeur (zPos, multi-calques,
  palette swap, robe sans pantalon), empreinte, avatar aléatoire, adaptateur sharp ; UI :
  `AvatarSprite`, `AvatarEditor`, `PhraseForm`, `Place`.
- core : `Avatar` et `UserAvatarItem`, `validateAvatarConfig`, `saveAvatar` (R2 + événement
  `avatar/updated`), `setAvatarPhrase` (phrase dite sur la place), `ensureAvatar`,
  `ensureMissingAvatars`, `listPlaceMembers`, `listEventsSince`. storage : `putObject` et
  `deleteObject`.
- Web : page `/avatar` (lien « Mon avatar » du menu), routes `/api/avatars/[userId]/[hash]`
  et `/api/place`, place sous la grille des apps, page `/credits`.

**Tests**

- Import : élément écarté sans l'une des 5 animations, sans la morphologie ou au mauvais nombre de
  frames ; calques multiples gardés avec leur zPos.
- Compositeur : ordre des calques, multi-calques, robe et pantalon, couleurs de peau.
- Validation : élément inexistant, incompatible, non possédé ; couleur hors palette.
- Phrase : remise sur une ligne, retirée si vide, refusée trop longue ou sans avatar, gardée
  quand l'avatar change.
- Empreinte : stable pour une même config, nouvelle pour une config modifiée.
- Routes et action refusées sans session (401) et pour une session révoquée (403).

**Fini quand**

- Un membre personnalise son avatar, le voit se promener sur la place,
  et les autres le voient changer au rafraîchissement suivant (30 s).

---

## Étape 10 : Agents Doubles ✅

Deuxième jeu du portail, à deux : les règles de Codenames Duet, coopératives, au tour par tour.
Détails du jeu : [games/agents/README.md](../games/agents/README.md).

**Tâches**

- `games/agents` : schéma Postgres `agents` (`games`, `clues`, `guesses`, modèles préfixés
  `Agents`), règles sans base de données (`src/rules.ts` : tirage des cartes, indice, mot touché,
  fin de tour, mort subite), parties, notifications et classement des duos.
- Liste d'environ 1 700 mots, dont des personnages ultra connus (jeux vidéo, films, séries).
- Routes `/api/agents/games`, `/api/agents/games/[id]` et `/api/agents/leaderboard`
  (requireMember), pages `/agents` et `/agents/[id]`, tuile du registre, événement
  `agents/mission_completed` dans le fil d'activité (avec le nom du partenaire).

**Tests**

- Cartes : 9 agents et 3 assassins par carte, 15 agents en tout, répartition du jeu.
- Mots : pas de doublon, grille sans mots trop proches ; indice refusé s'il ressemble à un mot de la
  grille.
- Partie : chacun ne voit que sa carte, témoin qui passe la main, assassin, victoire, mort subite,
  coups simultanés jamais comptés deux fois, abandon, liste des parties.
- Classement des duos ; chaque route et page refusent sans session (401) et une session révoquée
  (403).

**Fini quand**

- Deux membres jouent une mission jusqu'au bout et apparaissent au classement des duos et dans
  l'activité.

---

## Étape 11 : vote du design des cartes ✅

Préparation du futur jeu de cartes : les membres notent des propositions de design. Détails :
section « Vote du design des cartes » de [ARCHITECTURE.md](ARCHITECTURE.md).

**Tâches**

- `games/tcg` : schéma Postgres `tcg` (`design_votes`), `rateDesign` (tout membre),
  `listDesignVotes`, propositions dans `src/designs.ts` (numéro = place dans la liste),
  `commentTags` (« à supprimer », « variant », négations ignorées).
- UI : aperçus de cartes (`ui/DesignPreview.tsx`, vagues `cards`, `premium`, `snap`, `v2`, `v3`, `v4`, `v5`),
  notation par étoiles et commentaire (`DesignRating`), zoom sur une carte, inclinaison au pointeur.
- Web : page `/cartes` (onglets Design, Effets de rareté et Variantes masqués pour l'instant,
  Archives), tuile « Vote design des cartes », `/api/cartes/exemple` (image de l'idée exemple),
  export admin `/api/admin/cards/votes`.

**Tests**

- Vote ouvert aux membres, une note par membre et par design, note de 0 à 5.
- Numéros stables (le n°70 seul en cours, 65 et 66 aux Archives), mots-clés et négations.
- `/cartes` et `/api/cartes/exemple` refusent sans session (401) et pour une session révoquée (403) ;
  l'export reste à 403 pour un membre.

**Fini quand**

- Un membre note les propositions de l'onglet Design, et les admins retrouvent les notes dans
  l'export.

---

## Étape 12 : audit du 2026-10-25 ✅

Relecture complète du projet (sécurité, jeux, modules serveur, front, documentation), puis
corrections en PR séparées par thème.

**Tâches**

- Sécurité : endpoints Better Auth de modification du profil désactivés ; une panne Discord ne
  révoque plus les sessions (essai suivant dans 15 min, révocation après 24 h sans réponse,
  colonne `sessions.guild_unknown_since`).
- Déploiement : migrations après `next build` (`deploy:production`), build dans la CI, procédure
  `prisma migrate resolve` documentée.
- Web : pages d'erreur, 404 et chargement ; dates en heure de Paris (`BRAND.timeZone`) ; `refresh()`
  après les actions ; cloche fiable ; en-têtes `private, no-store` ; données de session réduites.
- Serveur : plafond et purge des envois d'image, solde plafonné (`MAX_BALANCE`), cache de sprites
  borné, planches orphelines supprimées, événements de la place sans perte ni doublon,
  `check:boundaries` élargi.
- Jeux : TROIS (bascule de jour, contrastes, rangs ex æquo, puis délai de grâce de 30 min après
  minuit pour une journée commencée, alerte dès 23h45 et historique du classement) ; Agents
  Doubles (mort subite, une
  partie en cours par paire, accessibilité) ; cartes (négations, onglets masqués, archives
  allégées).
- Documentation remise à jour, règle « doc à jour dans chaque PR » ajoutée à CLAUDE.md.

**Fini quand**

- Toutes les PR sont fusionnées, CI verte, déployées.

---

## Étape 13 : cartes du jeu (en cours)

Structure retenue : document « Potopia TCG — structure finale » (modèle retenu le 2026-10-30, effets en
catalogue, admin des cartes). Détails : section « Cartes du jeu » de [ARCHITECTURE.md](ARCHITECTURE.md).

**Tâches**

- [x] Schéma `tcg` : `TcgSet`, `TcgCard`, enum `TcgRarity` (migration `tcg_cards`, ajout seul).
- [x] Catalogue d'effets (`src/effects.ts`) et fonctions des cartes (`src/cards.ts`).
- [x] Admin : `/admin/cartes`, `/admin/cartes/[id]`, `/admin/cartes/nouvelle`,
      `/admin/cartes/import`, `/admin/cartes/illustrations` (envoi en masse),
      `/api/admin/cards/[id]/image` ; entrée « Cartes » sur `/admin`.
- [x] Réserve et sets (cartes hors set en attente, déplacement en masse, renumérotation),
      plusieurs cartes par idée et création depuis la page d'une idée (garde-fou anti-doublon),
      titre ajusté à sa longueur ; migration `tcg_card_reserve` (modifie des contraintes, sans
      toucher aux données).
- [x] Cadrage des illustrations dans l'éditeur (glisser, zoomer), migration
      `tcg_card_image_frame` (ajout d'une colonne).
- [x] Une carte par idée de la boîte à idées, générée hors du dépôt et importée par l'admin ;
      illustrations libres (Wikimedia Commons, crédits notés) pour les idées sans image.
- [ ] Lieux, boosters (stock par set, journal en ajout seul, achat et gains), collection et
      Potodex, revente des doublons.
- [ ] Decks, défis, moteur de résolution des tours, page de partie.
- [ ] Crédits des illustrations libres (CC BY, CC BY-SA : auteur et licence) sur la page
      Crédits, dès que les cartes seront visibles des membres.

**Tests**

- Catalogue : clés uniques, texte pour chaque effet, réglages bornés.
- Cartes : réservées aux admins, numérotation à la suite, texte d'effet proposé, effet inconnu ou
  mal réglé refusé, variantes (stats reprises et recopiées, pas de variante d'une variante), import
  (idées déjà importées ignorées, tout ou rien), illustration (envoi présigné, clé vérifiée dans le
  stockage, formats et droits).
- Idées : `listIdeaIdsWithImage` réservé aux admins.

**Fini quand**

- Les cartes du set 1 sont en base de prod et modifiables dans l'admin ; puis les étapes suivantes
  (boosters, parties) cochées.
