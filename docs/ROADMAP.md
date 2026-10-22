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
- Scripts : `db:generate`, `db:migrate` (dev), `db:deploy` (prod), `db:seed`, `db:reset:test`.
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

## Étape 6 : `apps/web`

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
    - Colonne gauche : compte, solde, 5 dernières transactions, déconnexion.
    - Centre : grille de tuiles, puis fil d'activité.
    - Sur mobile, la colonne gauche passe dans un menu.
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

## Étape 7 : `packages/ideas`

**Tâches**

- `schema.prisma` (schéma `ideas`) : `Idea` et `IdeaUpload`, avec la migration.
- Validation zod : longueurs maximales, rareté (enum), types d'image et taille de 5 Mo.
- `createUploadUrl(userId, { contentType, size })` :
  - rate-limit à 10 par heure ;
  - génère la clé `ideas/<uuid>.<ext>` ;
  - crée la ligne `IdeaUpload` et renvoie l'URL présignée PUT.
- `submitIdea(userId, input)`, dans une seule transaction :
  - advisory lock par utilisateur et rate-limit à 5 par heure ;
  - si une image est jointe : la clé doit appartenir à l'utilisateur et ne pas avoir servi, on
    vérifie l'objet avec `HeadObject`, puis on marque l'upload comme utilisé ;
  - création de l'idée, puis `publishEvent("ideas", "idea_submitted", {})` et
    `notifyAdmins("Nouvelle idée reçue")`.
  - Valeur de retour : `{ ok: true }` uniquement.
- Admin : `listIdeas({ authorId?, rarity?, cursor })` et `getIdea(id)`.
- UI :
  - `IdeaForm` : upload direct vers R2, puis confirmation et formulaire vidé ;
  - `IdeasAdminList` avec filtres, et `IdeaDetail`.
- Web :
  - pages `/ideas`, `/admin/ideas` et `/admin/ideas/[id]` ;
  - routes `/api/ideas/upload-url` et `/api/admin/ideas/[id]/image` (redirection 302 vers une URL
    présignée GET) ;
  - tuile « Boîte à idées » dans le registre.

**Tests**

- Un non-admin reçoit 403 sur `listIdeas`, `getIdea` et la route image.
- Validation : champs trop longs, rareté invalide, type d'image refusé, image trop grosse.
- Au 6e envoi dans l'heure, l'envoi est refusé.
- La clé R2 est toujours générée côté serveur : une clé fournie par le client, déjà utilisée ou
  appartenant à un autre utilisateur est refusée.
- L'événement d'activité ne contient ni titre ni contenu.

**Fini quand**

- Un membre envoie une idée avec une image, et seul l'admin la voit, image comprise.

---

## Étape 8 : finitions

**Tâches**

- Script `pnpm check:boundaries` : il lit les `.prisma` pour associer chaque modèle à son domaine,
  puis signale tout `db.<modèle>` utilisé hors de son domaine.
- Seed fictif : quelques users inventés, des transactions et des événements.
- CI GitHub Actions : install, lint, typecheck, check:boundaries, test (service Postgres) et build.
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
