# Architecture et décisions

Plateforme web de mini-jeux pour un groupe d'amis Discord. Nom de code et nom de la monnaie : voir
`packages/config/brand.ts` (seul endroit où ils apparaissent).

Ce document décrit le socle (étape 1 du projet) : plateforme, base commune (monnaie, activité,
notifications) et boîte à idées. Aucun jeu pour l'instant.

## Stack

| Sujet       | Choix                                                                                |
| ----------- | ------------------------------------------------------------------------------------ |
| Monorepo    | pnpm workspaces + Turborepo, TypeScript 6.0 strict                                   |
| Web         | Next.js 16 (App Router), React 19, Tailwind v4                                       |
| Base        | PostgreSQL (Neon, URL poolée), Prisma 7 + `@prisma/adapter-pg`, multiSchema          |
| Auth        | Better Auth, provider Discord uniquement                                             |
| Stockage    | Cloudflare R2 privé (`@aws-sdk/client-s3`, `s3-request-presigner`) ; RustFS en local |
| Validation  | zod 4                                                                                |
| Tests       | Vitest 5, Postgres et stockage S3 locaux via Docker (`docker compose`)               |
| Hébergement | Vercel, repo GitHub public                                                           |

Notes de versions :

- TypeScript reste en 6.0 tant que typescript-eslint ne supporte pas la 7.
- Prisma reste en 7.x : la version « latest » sur npm est une RC de la 8, et Better Auth exige `^7`.

Pourquoi Better Auth plutôt qu'Auth.js :

- il ne dépend d'aucun framework, donc `auth.api.getSession({ headers })` sera réutilisable par le
  futur serveur temps réel ;
- il a un adapter Prisma ;
- il propose des hooks pour refuser une connexion ;
- il chiffre les tokens OAuth en base.

## Arborescence

```
apps/web/            app Next mince : routes, layouts, server actions, route handlers
games/
  trois/             Wordle français à 3 mots par jour (premier jeu intégré)
packages/
  config/            tsconfig, eslint, brand.ts
  db/                client Prisma partagé, assemblage des schémas, migrations, seed
  core/              auth, users, rôles, accès, registre des apps, activité, notifications
  economy/           monnaie : ledger + wallets
  ideas/             boîte à idées (module autonome, indépendant du futur TCG)
  storage/           client R2 + URLs présignées (aucune logique métier)
  ui/                thème (variables CSS, sombre par défaut) + composants de base
```

Chaque module (`core`, `economy`, `ideas`, plus tard chaque jeu) contient :

- son `schema.prisma`, sous la forme d'un schéma Postgres à son nom ;
- son code serveur ;
- son dossier `ui/`, en React pur sans import Next.

Les server actions vivent dans `apps/web` : elles appellent les fonctions des modules et passent les
actions aux composants en props.

**Assemblage des schémas.** Prisma n'accepte qu'un seul dossier de schéma. Un script
`packages/db/scripts/assemble.ts` copie donc les `schema.prisma` des modules dans
`packages/db/prisma/schema/` (dossier généré et gitignoré), avant `generate` et `migrate`.

## Règles d'architecture

1. **Frontières.** Un module ne lit et n'écrit jamais les tables d'un autre ; il passe par les
   fonctions exposées par ce module.
   - Il n'y a **pas de FK ni de relation Prisma entre domaines** : `userId` est une simple colonne.
   - Les FK restent autorisées à l'intérieur d'un même domaine.
   - On ne supprime jamais d'utilisateurs, donc il n'y a pas de risque de données orphelines.
   - Le script `pnpm check:boundaries`, lancé en CI, vérifie qu'aucun package n'utilise
     `db.<modèle>` d'un autre domaine.
2. **Transactions composables.** Chaque fonction d'écriture a la forme
   `fn(input, opts?: { tx?: DbTx })`, ce qui permet de composer plusieurs modules dans une même
   transaction SQL.
3. **Nom de marque.**
   - La marque vient uniquement de `brand.ts`.
   - Packages : `@app/*`. Schémas et tables : noms fonctionnels (`core`, `economy`, `ideas`).
4. **Pas de Next dans `packages/*` ni dans `games/*`.** Une règle ESLint `no-restricted-imports`
   l'interdit, pour que ces modules restent réutilisables dans le futur serveur temps réel
   (`apps/realtime`).
5. **Secrets.** Aucun secret dans le repo : `.env` est gitignoré, `.env.example` est documenté.
6. **Contenu.** Aucun contenu réel dans le repo : tout vit en base ou dans R2. Les seeds ne
   contiennent que des données fictives. Le repo étant public, la doc, les tests et les messages de
   commit n'utilisent que des placeholders : ni ID Discord réel, ni infos de prod (domaine, bucket,
   comptes), ni pseudos ou contenus des membres.

## Accès

- **Connexion** par Discord, avec les scopes `identify email guilds`.
  - À la connexion, le serveur appelle `GET /users/@me/guilds` et vérifie la présence de
    `DISCORD_GUILD_ID`.
  - Si l'utilisateur n'est pas membre, aucun compte ni session n'est créé et il est redirigé vers
    `/refused`.
  - Ce contrôle vit dans le `getUserInfo` du provider Discord : il s'exécute juste après l'échange
    du code OAuth, avant toute écriture de Better Auth en base. Si Discord est injoignable, la
    connexion échoue vers `/login?error=…`.
  - `discordId` est recopié depuis le compte Discord lié (`accounts.account_id`) à chaque création
    de session. Il n'est jamais modifiable par l'utilisateur (`input: false`), sinon un membre
    pourrait se donner l'ID d'un admin via l'API Better Auth.
- **Revérification toutes les 6 h** (champ `guildCheckedAt` sur la session). Un membre qui a quitté
  le serveur voit sa session révoquée ; ses données sont conservées.
  - Le token Discord est rafraîchi au besoin. Un refresh refusé ou un 401 de Discord vaut révocation
    (l'utilisateur a retiré l'autorisation).
  - Une panne ou un rate-limit de Discord ne révoque rien : la session est gardée et la vérification
    retentée à la requête suivante.
  - `requireMember` renvoie 401 sans session, 403 quand la session vient d'être révoquée.
- **Pas de bot Discord.** La plateforme ne connaît donc que les membres déjà connectés au moins une
  fois. Un bot pourra être ajouté plus tard si besoin.
- **Admins** : liste `ADMIN_DISCORD_IDS`.
  - Les contrôles d'admin lisent toujours l'env directement, ce qui rend une révocation immédiate.
  - Le champ `role` en base est un simple miroir, mis à jour à chaque connexion.
- **Contrôles côté serveur** : chaque layout, server action et route handler appelle
  `requireMember()` ou `requireAdmin()`. `proxy.ts` ne fait qu'un contrôle optimiste du cookie
  (redirection vers `/login`, ou 401 JSON pour `/api/*`).
  - Dans `apps/web`, les layouts et pages passent par `getCurrentMember()` / `getCurrentAdmin()`
    (`lib/session.ts`) : redirection vers `/login` sans session, vers `/refused` si la session
    vient d'être révoquée, `forbidden()` (403, `app/forbidden.tsx`) pour un non-admin. Les server
    actions appellent `actionMember()` / `actionAdmin()`, qui lèvent `UnauthorizedError` (401) ou
    `ForbiddenError` (403).
  - Seules exceptions : les routes `/api/auth/*` de Better Auth et les actions de connexion et de
    déconnexion, qui ouvrent et ferment la session.
  - Les cookies posés par `getAuth().api.*` depuis une server action sont recopiés par
    `applyAuthCookies` (`lib/auth-cookies.ts`), l'équivalent du plugin `nextCookies` de Better
    Auth, qui ne peut pas vivre dans `packages/core` (pas d'import Next).

## Modèle de données

### core

- `User` : id, `discordId` (unique), name, image (avatar sur le CDN Discord), email,
  `role` (`member` | `admin`), createdAt, updatedAt.
- `Session`, `Account`, `Verification` : tables de Better Auth. Les tokens OAuth sont chiffrés, et la
  session porte en plus `guildCheckedAt`.
- `ActivityEvent` : id, userId, app, type, payload (Json), createdAt.
- `Notification` : id, userId, title, link?, readAt?, createdAt.

### economy

- `Wallet` : userId (PK), balance (Int, `CHECK balance >= 0`), updatedAt.
- `Transaction` (table `transactions`) : id, seq (ordre réel d'application, tiré à l'insertion), userId,
  amount (Int signé, ≠ 0), reason, ref?,
  idempotencyKey (unique), balanceAfter, actorId? (l'admin à l'origine de l'opération), createdAt.
- **Ledger en ajout seul** : un trigger SQL lève une erreur sur tout UPDATE ou DELETE de
  `transactions`. Une correction se fait par une transaction inverse.

### ideas

- `Idea` : id, authorId, title (≤ 100), description (≤ 2000), concernedPeople (texte libre ≤ 200,
  optionnel), suggestedRarity (`common` | `uncommon` | `rare` | `legendary`, optionnel), effectIdea
  (≤ 1000, optionnel), imageKey?, createdAt.
- `IdeaUpload` : key (PK), userId, contentType, size, createdAt, usedAt?. Une idée ne peut
  référencer qu'une clé émise par le serveur, pour ce même utilisateur, et une seule fois.

## Mécanismes clés

**`credit()` et `debit()`.** Tout se fait dans une seule transaction SQL :

1. créer le wallet s'il n'existe pas ;
2. le verrouiller avec `SELECT … FOR UPDATE` (crédit comme débit, pour que `balanceAfter` reste
   juste sous concurrence) ;
3. si la clé d'idempotence existe déjà, renvoyer la transaction d'origine, même si le solde a changé
   depuis ; une clé réutilisée pour un autre membre ou un autre montant lève
   `IdempotencyConflictError` ;
4. pour un débit, refuser l'opération si le solde est insuffisant (`InsufficientFundsError`) ;
5. `INSERT … ON CONFLICT (idempotency_key) DO NOTHING RETURNING`, qui couvre la même clé insérée en
   parallèle sur un autre wallet ;
6. mettre à jour le solde.

Ces étapes sont en SQL brut plutôt que de rattraper l'erreur Prisma P2002, car une erreur dans une
transaction Postgres annule toute la transaction.

Le trigger d'ajout seul bloque UPDATE et DELETE, pas TRUNCATE : les tests vident la base avec
TRUNCATE.

Pour l'instant, aucune app ne crédite de monnaie : seul l'admin le fait, avec un motif obligatoire.

**Upload d'image (boîte à idées).**

1. `POST /api/ideas/upload-url` : validation zod (jpeg, png ou webp, 3 Mo max).
2. Le serveur génère la clé `ideas/<uuid>.<ext>`, crée la ligne `IdeaUpload`, puis renvoie une URL
   PUT présignée valable 5 min, qui signe `ContentType` et `ContentLength`.
3. À la soumission de l'idée, le serveur verrouille la ligne `IdeaUpload` (`FOR UPDATE`), vérifie
   qu'elle a été émise pour ce membre et jamais utilisée, fait un `HeadObject` (l'objet existe-t-il,
   et sa taille est-elle celle annoncée ?) puis marque l'upload comme utilisé. Toute anomalie lève
   `InvalidImageError` et annule la soumission.

En base, on stocke la clé, jamais une URL. Le CORS du bucket n'autorise que le PUT et le GET depuis
l'origine de l'app (`pnpm storage:init` en local, dashboard R2 en prod).

**Lecture d'image.** `GET /api/admin/ideas/[id]/image` exécute `requireAdmin()` puis redirige (302)
vers une URL GET présignée valable 5 min. Toute autre personne reçoit un 403.

**Boîte noire.**

- L'action de soumission renvoie seulement `{ ok: true }`.
- Aucune API de lecture n'est ouverte aux membres : `listIdeas`, `getIdea` et `getIdeaImageUrl`
  prennent le lecteur en premier argument et lèvent `ForbiddenError` s'il n'est pas admin, en plus
  des contrôles de l'app.
- Le seul événement d'activité émis est `ideas / idea_submitted`, avec un payload vide.

**Rate-limit des idées.**

- Comptage en base sur l'heure glissante, protégé par un `pg_advisory_xact_lock` par utilisateur.
- Pas de limite d'envoi (ni idées ni images) : la plateforme est réservée au groupe.

**Notifications.**

- Les admins reçoivent « Nouvelle idée reçue », sans aucun contenu.
- Un membre est notifié quand un admin le crédite ou le débite.

**Registre des apps** (`packages/core/src/apps/registry.ts`).

- Une entrée a la forme `{ id, name, icon, route, requiredRole }`, où `icon` est un nom d'icône
  lucide.
- Une tuile n'est visible que si l'utilisateur a le rôle requis.
- Tuiles actuelles : « Boîte à idées » (membres) et « Administration » (admins). Le TCG aura sa propre
  tuile.

**Thèmes.** Tout le style passe par `packages/ui/theme.css` : couleurs, police des titres, dégradés et
décors.

- Un thème est un bloc `[data-theme="…"]` de variables CSS, déclaré aussi dans
  `packages/ui/src/themes.ts`. Trois thèmes : **Classique**, le thème par défaut (bleu sobre, sans
  décors), **Fantasy** (or, pourpre, cadres ornés, braises, titres en Cinzel) et **RGB** (néon gaming :
  la teinte de l'accent tourne en continu via une propriété CSS animée, cadres à bordure arc-en-ciel,
  boucle de watercooling animée en fond, titres en Orbitron).
- Les décors s'activent par variables (`--ornaments`, `--embers`, `--ambient`, `--fans`) : un thème
  sobre les coupe sans toucher aux composants.
- Le choix se fait avec le bouton palette du header (`ThemeSwitcher`). Il est mémorisé par appareil
  dans le cookie `theme`, que le layout racine lit pour poser `data-theme` dès le rendu serveur, sans
  flash.
- Les animations (apparitions en cascade, reflets, cloche, braises) sont coupées si l'appareil demande
  moins d'animations.
- Les jeux gardent leur propre style pour l'instant (TROIS).

## Tests (Vitest)

- **economy** (sur un vrai Postgres) :
  - même clé d'idempotence = un seul crédit ;
  - débits concurrents sans solde négatif ;
  - le solde est égal à la somme du ledger ;
  - le trigger bloque bien UPDATE et DELETE.
- **ideas** :
  - un non-admin reçoit 403 sur la lecture d'une idée ou d'une image ;
  - validation des entrées ;
  - limite d'envois ;
  - clé R2 générée côté serveur, et refus d'une clé fournie par le client ou émise pour un autre
    utilisateur.
- **accès** :
  - un non-membre du serveur Discord est refusé partout ;
  - la session est révoquée après la revérification ;
  - chaque route est bien protégée.

## Étapes de réalisation

- [x] 1. Init : monorepo, `packages/config`, Turbo, Prettier, `.env.example`, `docker-compose.yml`.
- [x] 2. `packages/db` : assemblage des schémas, Prisma, migration initiale (triggers, CHECK), seed
      fictif.
- [x] 3. `packages/core` : Better Auth + Discord + contrôle d'appartenance au serveur, users, guards,
      registre, activité, notifications, et leurs tests.
- [x] 4. `packages/economy` : ledger, wallets, et leurs tests.
- [x] 5. `packages/storage` et `packages/ui` : client R2, presign, thème sombre, primitives.
- [x] 6. `apps/web` : login, `/refused`, header avec cloche, dashboard façon Odoo responsive, page
      admin de la monnaie.
- [x] 7. `packages/ideas` : formulaire, upload, pages admin, et leurs tests.
- [x] 7b. `games/trois` : intégration du jeu TROIS (identité Discord, classement, activité).
- [x] 8. Finitions : `check:boundaries`, CI GitHub Actions, README complet.

## Hors périmètre (pour l'instant)

Cartes jouables, boosters, combat, design final. Pas de récompense en monnaie dans TROIS pour
l'instant.

## Environnement de dev

- Le projet doit être sur un **disque local**. Un partage réseau SMB refuse les liens symboliques
  dont pnpm a besoin.
- Docker Desktop doit être lancé pour les services locaux (`pnpm db:up`) : Postgres et un stockage
  compatible S3 (RustFS) qui remplace R2. `R2_ENDPOINT` pointe dessus ; en prod il reste vide et
  l'endpoint R2 du compte est utilisé. Le bucket local se crée avec `pnpm storage:init`. MinIO n'est
  plus publié en image Docker, d'où RustFS.
- `pnpm dev` lance l'app sur `http://localhost:3000`. `next.config.ts` charge le `.env` de la
  racine (Next ne lit sinon que celui de `apps/web`).
- Tailwind n'analyse pas `node_modules` : `app/globals.css` déclare chaque dossier de composants des
  packages avec `@source`, un par un (un glob du type `packages/*/ui` n'est pas pris en compte).
  Ajouter une ligne pour tout nouveau package qui a un dossier `ui/`.
- Après l'ajout d'un package au monorepo : `pnpm install`, puis redémarrer `pnpm dev`. Si Next ne
  trouve toujours pas le package, vider son cache de dev (`apps/web/.next/dev`), qui garde les échecs
  de résolution d'un lancement à l'autre.
