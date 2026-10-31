# Architecture et décisions

Plateforme web de mini-jeux pour un groupe d'amis Discord. Nom de code et nom de la monnaie : voir
`packages/config/brand.ts` (seul endroit où ils apparaissent).

Ce document décrit la plateforme telle qu'elle est : socle (accès Discord, monnaie, activité,
notifications), boîte à idées, avatars et place, deux jeux (TROIS et Agents Doubles) et le vote du
design des futures cartes. Il est tenu à jour à chaque changement (voir CLAUDE.md).

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
| Hébergement | Vercel, repo GitHub public ; migrations appliquées par le build de production        |

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
  agents/            Agents Doubles, jeu d'espions coopératif à deux (règles de Codenames Duet)
  tcg/               futur jeu de cartes : pour l'instant, le vote du design des cartes (/cartes)
  trois/             Wordle français à 3 mots par jour (premier jeu intégré)
packages/
  config/            tsconfig, eslint, brand.ts
  db/                client Prisma partagé, assemblage des schémas, migrations, contrôle des
                     frontières, migrations de production (`deploy:production`)
  core/              auth, users, rôles, accès, registre des apps, activité, notifications, avatars
  avatar/            compositeur d'avatars LPC (client et serveur), éditeur, place du dashboard
  avatar-assets/     sprites LPC importés, catalogue, palettes, crédits (pnpm assets:import)
  economy/           monnaie : ledger + wallets
  ideas/             boîte à idées (module autonome, indépendant du futur TCG)
  inventory/         inventaire : objets trouvés (Émeraudes du Chaos), puis hauts faits
  storage/           client R2 + URLs présignées (aucune logique métier)
  ui/                thème (variables CSS, sombre par défaut) + composants de base
```

Chaque module (`core`, `economy`, `ideas`, plus tard chaque jeu) contient :

- son `schema.prisma`, sous la forme d'un schéma Postgres à son nom ;
- son code serveur ;
- son dossier `ui/`, en React pur sans import Next.

Les server actions vivent dans `apps/web` : elles appellent les fonctions des modules et passent les
actions aux composants en props.

**Liens entre pages.** Sans import Next, un composant de package ferait des `<a>` simples, qui
rechargent tout le site (la musique du header s'arrête, l'état client repart de zéro). Il utilise
donc `AppLink` (lien) et `useNavigate()` (navigation depuis du code) de `@app/ui` : `<a>` et
`window.location` par défaut, branchés sur `Link` et `router.push` de Next par
`apps/web/components/NextNavigation.tsx`, posé dans le layout racine. Un lien externe ou un
téléchargement d'API reste un `<a>`. Une page dont le composant client dépend d'un paramètre
d'URL le remonte avec `key` (ex. `<AgentsGame key={id} />`), pour repartir d'un état neuf quand on
passe d'une partie à l'autre sans rechargement.

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
  - Pseudo, image et e-mail viennent de Discord et ne se modifient pas depuis le site : les
    endpoints génériques de Better Auth qui le permettraient (`/update-user`, `/change-email`,
    `/change-password`, `/link-social`, `/unlink-account`) sont désactivés (`disabledPaths`) et
    répondent 404, sinon un membre pourrait prendre le pseudo d'un autre dans le fil d'activité
    ou les classements.
- **Revérification toutes les 6 h** (champ `guildCheckedAt` sur la session). Un membre qui a quitté
  le serveur voit sa session révoquée ; ses données sont conservées.
  - Le token Discord est rafraîchi au besoin. Un 401 de Discord sur la liste des serveurs vaut
    révocation immédiate (l'utilisateur a retiré l'autorisation).
  - Une panne ou un rate-limit de Discord ne révoque rien : la session est gardée, la date de la
    première panne est notée (`guildUnknownSince`) et la vérification n'est retentée qu'après
    15 min (`GUILD_RETRY_MS`), pas à chaque requête. Better Auth ne distingue pas un refresh de
    token refusé d'une panne du endpoint token : ce cas est traité comme une panne. Au bout de
    24 h sans vérification réussie (`GUILD_GRACE_MS`), la session est révoquée malgré tout.
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
- `Avatar` et `UserAvatarItem` : voir « Avatars et place ».

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

### tcg

- `TcgDesignVote` : designId, userId, stars (0 à 5 ; 0 = commentaire sans note ou note retirée),
  comment?, createdAt, updatedAt. Une note par membre et par design (`(design_id, user_id)`
  unique). Les designs eux-mêmes sont dans le code (`games/tcg/src/designs.ts`), pas en base.

### trois et agents

Décrits dans les README des jeux : [games/trois/README.md](../games/trois/README.md) (`games`,
`guesses`, `daily_words`) et [games/agents/README.md](../games/agents/README.md) (`games`, `clues`,
`guesses`, index unique partiel : une seule partie en cours par paire de joueurs).

## Mécanismes clés

**`credit()` et `debit()`.** Tout se fait dans une seule transaction SQL :

1. créer le wallet s'il n'existe pas ;
2. le verrouiller avec `SELECT … FOR UPDATE` (crédit comme débit, pour que `balanceAfter` reste
   juste sous concurrence) ;
3. si la clé d'idempotence existe déjà, renvoyer la transaction d'origine, même si le solde a changé
   depuis ; une clé réutilisée pour un autre membre ou un autre montant lève
   `IdempotencyConflictError` ;
4. refuser l'opération si le solde deviendrait négatif (`InsufficientFundsError`) ou dépasserait
   `MAX_BALANCE` (1 000 000 000, `BalanceLimitError`, loin de la limite d'une colonne `integer`) ;
   l'admin voit un message d'erreur lisible dans le formulaire ;
5. `INSERT … ON CONFLICT (idempotency_key) DO NOTHING RETURNING`, qui couvre la même clé insérée en
   parallèle sur un autre wallet ;
6. mettre à jour le solde.

Ces étapes sont en SQL brut plutôt que de rattraper l'erreur Prisma P2002, car une erreur dans une
transaction Postgres annule toute la transaction.

Le trigger d'ajout seul bloque UPDATE et DELETE, pas TRUNCATE : les tests vident la base avec
TRUNCATE.

Pour l'instant, aucune app ne crédite de monnaie : seul l'admin le fait, avec un motif obligatoire.

**Upload d'image (boîte à idées).**

Avant tout, le navigateur réencode l'image en WebP (2048 px de côté max, métadonnées EXIF
retirées), puis contrôle la taille. S'il ne sait pas encoder le WebP, il envoie l'original.

1. `POST /api/ideas/upload-url` : validation zod (jpeg, png ou webp, 3 Mo max).
2. Le serveur compte les demandes du membre sur l'heure glissante (au plus 30,
   `UPLOAD_RATE_LIMIT`, sous `pg_advisory_xact_lock` par membre ; au-delà, `UploadRateLimitError`
   → 429 « Trop d'images envoyées en une heure »), génère la clé `ideas/<uuid>.<ext>`, crée la
   ligne `IdeaUpload`, puis renvoie une URL PUT présignée valable 5 min, qui signe `ContentType`
   et `ContentLength`.
3. À la soumission de l'idée, **avant** d'ouvrir la transaction, le serveur vérifie que la clé a
   été émise pour ce membre et jamais utilisée, puis fait un `HeadObject` (l'objet existe-t-il, sa
   taille et son type sont-ils ceux annoncés ?). L'appel réseau au stockage reste ainsi hors
   verrou et hors du délai de 5 s de la transaction. Dans la transaction, la ligne `IdeaUpload`
   est verrouillée (`FOR UPDATE`), revérifiée puis marquée comme utilisée. Toute anomalie lève
   `InvalidImageError` et annule la soumission.
4. **Purge** : chaque demande d'URL supprime au passage jusqu'à 20 uploads jamais utilisés de plus
   de 24 h (`purgeStaleUploads` : ligne supprimée sous verrou, objet supprimé du stockage dans la
   même transaction, annulée et retentée plus tard si le stockage refuse). Une image envoyée puis
   abandonnée ne reste donc pas dans le bucket.

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
- Seule exception (décidée le 2026-10-25) : l'idée exemple du vote des designs de cartes
  (`SHOWCASE_IDEA_ID`). `getShowcaseIdea` et `getShowcaseImageUrl` la renvoient sans contrôle
  d'admin, et `/cartes` et `/api/cartes/exemple` (requireMember) l'affichent à tous les membres.
  Aucune autre idée n'est concernée.

**Limites d'envoi.**

- Idées : aucune limite, la plateforme est réservée au groupe.
- Demandes d'URL d'envoi d'image : 30 par membre et par heure glissante (voir « Upload d'image »),
  pour qu'un onglet qui boucle ou un script ne remplisse pas le bucket.

**Notifications.**

- Les admins reçoivent « Nouvelle idée reçue », sans aucun contenu.
- Un membre est notifié quand un admin le crédite ou le débite.

**Registre des apps** (`packages/core/src/apps/registry.ts`).

- Une entrée a la forme `{ id, name, icon, route, requiredRole }`. `icon` est un nom déclaré dans
  l'union `AppIconName` (`registry.ts`) et associé à une icône lucide dans `ICONS`
  (`packages/core/ui/AppGrid.tsx`) : une nouvelle icône demande les deux.
- Une tuile n'est visible que si l'utilisateur a le rôle requis.
- Tuiles actuelles, dans l'ordre : « TROIS », « Agents Doubles », « Boîte à idées », « Vote design
  des cartes » (membres), puis « Administration » (admins).
- Le fil d'Ariane prend le nom des apps dans ce registre (`components/Breadcrumb.tsx`, composant
  serveur) ; seule exception, le libellé plus court « Design des cartes » pour `/cartes`.

**Thèmes.** Tout le style passe par `packages/ui/theme.css` : couleurs, police des titres, dégradés et
décors.

- Un thème est un bloc `[data-theme="…"]` de variables CSS, déclaré aussi dans
  `packages/ui/src/themes.ts`. Quatre thèmes : **Classique**, le thème par défaut (bleu sobre, sans
  décors), **Fantasy** (or, pourpre, cadres ornés, braises, titres en Cinzel), **RGB** (néon gaming :
  la teinte de l'accent tourne en continu via une propriété CSS animée, cadres à bordure arc-en-ciel,
  boucle de watercooling animée en fond, titres en Orbitron) et **JoJo** (Stardust Crusaders : nuit
  indigo, or et violet, cadres encrés façon case de manga avec étoiles Joestar, titres en Anton ;
  petits textes en capitales pleines pour rester lisibles).
- Les décors s'activent par variables (`--ornaments`, `--embers`, `--ambient`, `--fans`, `--jojo`) :
  un thème sobre les coupe sans toucher aux composants. Décor JoJo (`JojoDecor`) : trame, rayons,
  portraits pixel art du jeu de Capcom (`public/jojo/portrait-*.png` : Jotaro, Star Platinum, DIO,
  The World), « ゴゴゴ » qui montent, étoiles, Jotaro qui prend la pose (`jotaro-pose.png`).
- Passer au thème JoJo déclenche **ZA WARUDO** (`apps/web/components/ZaWarudo.tsx`, `zaWarudo()` de
  `@app/ui`) : la voix (`public/audio/za-warudo.mp3`), une onde qui inverse les couleurs, la page
  figée et délavée (« 時よ止まれ ! »), puis la reprise (`time-resume.mp3`). Un clic ou Échap
  abrège. Pendant l'effet, tout le reste s'arrête vraiment : les animations en JavaScript lisent
  l'horloge commune `timeNow()` (`packages/ui/src/timeStop.ts`), que `stopTime()` fige ; les sons
  en cours sont mis en pause puis reprennent (`trackMedia()`), la musique en Web Audio de Super
  Sonic aussi (`onTimeStop`).
- Le choix se fait avec le bouton palette du header (`ThemeSwitcher`). Il est mémorisé par appareil
  dans le cookie `theme`, que le layout racine lit pour poser `data-theme` dès le rendu serveur, sans
  flash.
- Les animations (apparitions en cascade, reflets, cloche, braises) sont coupées si l'appareil demande
  moins d'animations.
- Les jeux gardent leur propre style pour l'instant (TROIS, Agents Doubles, cartes du vote) : une
  feuille CSS par jeu (`games/*/ui/*.css`), importée dans `apps/web/app/globals.css`.

**Header** (`packages/core/ui/Header.tsx`, boutons passés par `(platform)/layout.tsx`). De gauche à
droite : Sonic, Luffy, la boule musicale, thème, cloche, volume, menu du profil.

- Sonic (`apps/web/components/SonicRun.tsx`, masqué sous 1024 px), Luffy
  (`components/LuffyRun.tsx`, masqué sous 640 px) et la boule (`components/SpinOrb.tsx`) lancent
  une animation et une musique en boucle au clic, et se mettent en pause au second.
- Sonic : planches en pixel art à l'échelle 1 dans `public/sonic/` (attente, marche, course, sprint,
  puis transformation, course, vol et attente de Super Sonic), tirées de gifs de sources
  différentes, ramenées à la même taille de pixel et aux mêmes couleurs. À l'arrêt il attend (la
  pause du gif d'origine allongée) ; au clic, musique `public/audio/sonic.mp3` (silences de début
  et de fin coupés, pour boucler sans trou) : il marche, accélère, court, pique des sprints de 4,5
  à 7 s, avec de petits traits de vitesse à la couleur du thème. Traînée en tirets sur le liseré, à la couleur du thème, dont les tirets défilent à sa
  vitesse. Les 7 Émeraudes du Chaos trouvées et leur pouvoir libéré (`superSonic`, voir
  Inventaire), le clic le transforme en Super Sonic : transformation (~1,7 s), départ en
  trottinant puis sprint bien plus rapide que Sonic (4,5 s en tout), puis il s'envole. Traînée
  toujours dorée quel que soit le thème, de plus en plus longue (vol : ~600 px, le double du
  sprint), avec images rémanentes et lignes de vitesse quand il fonce. Sa musique
  (`public/audio/super-sonic.mp3`, morceau d'origine) boucle sans blanc ni fondu grâce à
  `components/loopTrack.ts` (Web Audio, trois tours exacts du thème de 19,69 s). Une fois transformé, il le reste (mémorisé sur
  l'appareil) : son attente devient celle de Super Sonic (`sonic-ss-idle.png`), en lévitation
  au-dessus du liseré, et les clics suivants sautent la transformation.
- Combo Luffy + steel ball (`components/LuffyCombo.tsx`, état partagé dans
  `components/headerStage.ts`) : si la boule tourne et qu'on clique sur le fruit, Luffy sort du
  fruit en courant sur place (`public/luffy/luffy-run-sheet.png`) puis file vers la gauche. La
  boule se charge dans sa case pendant que sa musique s'éteint (0,9 s), en jaillit dans un éclair
  et le poursuit en roulant sur le liseré (rotation = distance / rayon, dans le sens du
  mouvement). Aux bords, elle freine, s'écrase, soulève un peu de poussière et repart en
  accélérant ; Luffy fait demi-tour en sautant et c'est lui qui la poursuit. Le générique de One
  Piece (`public/audio/one-piece.mp3`) arrive ensuite en fondu. Pendant le combo, la case de la
  boule montre un bouton stop ; à l'arrêt, tout s'efface en 0,6 s et chacun regagne sa case. Le
  calque ne déborde jamais du header (pas de barre de défilement).
- Notification de test : « M'envoyer une notification de test » en bas de la liste de la cloche
  (server action `sendTestNotification`, réservée aux admins, `lib/notifications.ts`).
- Luffy : à l'arrêt, son fruit du démon flotte au-dessus du liseré (`public/luffy/devil-fruit.png`,
  pixel art 24 × 33, étoiles de l'image d'origine retirées) avec quelques étincelles qui
  s'allument au hasard. Au clic, le fruit tremble, éclate en lumière et Luffy en sort en
  rebondissant ; en pause, l'inverse (animations `luffy-*` de `app/globals.css`).
- Luffy en action : planche de 25 frames à fond transparent (`public/luffy/luffy-sheet.png`, tirée
  du gif d'origine), musique `public/audio/luffy.mp3`. Le sol du gif est retiré : c'est le liseré
  doré du header qui se creuse et se bombe quand il rebondit (profils par frame dans
  `components/luffyGround.ts`, déformation exagérée ×2,5, Luffy décalé pour suivre la ligne, qui
  s'allume quand elle se tend). Le liseré du header accepte une trouée, `--line-gap-from` /
  `--line-gap-to` (px depuis son bord gauche) posées sur le `<header>` ; Luffy y redessine le
  liseré en SVG, déformé, avec le même dégradé.

**To Be Continued** (`apps/web/components/ToBeContinued.tsx`, monté dans le layout racine).
`toBeContinued()` de `@app/ui` le déclenche : un mot raté pour de vrai à TROIS, une mission perdue
sous les yeux du joueur à Agents Doubles. L'intro de Roundabout (`public/audio/roundabout.mp3`,
~9 s coupées dans le morceau) démarre ; à son pic (2,4 s) la page se fige en sépia
(`html.tbc-freeze`, animations en pause) et la flèche « To Be Continued »
(`public/jojo/to-be-continued.png`) glisse en bas à gauche. Un clic ou Échap écourte.

**Inventaire** (`packages/inventory`, schéma `inventory`, table `items` : `user_id`, `item_id`,
`found_at`, unique par membre et objet).

- Catalogue dans le code (`src/catalog.ts`) : les 7 Émeraudes du Chaos. `collectItem`
  (idempotent, refuse un objet hors catalogue) et `listItems`.
- Chaque émeraude est cachée dans une page (`HiddenEmerald`, discrète, un éclat de temps en
  temps), à des endroits variés : accueil (à côté du lien des crédits de la place), Ma monnaie
  (au bout de la phrase de l'historique), Mon avatar (bord gauche), TROIS (après le fil d'Ariane),
  Agents Doubles (bord droit), Crédits (tout en bas), Boîte à idées (dans le titre). Le layout
  `(platform)` charge les objets du membre et pose `EmeraldsProvider`, qui cache celles déjà
  trouvées ; un clic joue un bruitage de Sonic 2 (`public/audio/emerald.mp3`, découpé à la main, discret) et appelle
  la server action `collectEmerald` (`app/actions/inventory.ts`), qui rafraîchit le layout.
- Page `/inventaire` (« Mon inventaire », dans le menu sous « Mon avatar ») : « Chaos Emerald »,
  les 7 pierres disposées comme sur l'image d'origine (six en cercle autour de la bleue), en noir
  tant qu'elles ne sont pas trouvées ; puis les hauts faits (à venir).
- Les 7 réunies, « Sceller le pouvoir » / « Libérer le pouvoir » (`EmeraldCircle`, réglage gardé
  sur l'appareil, `ui/superSonic.ts`) : scellées, les pierres sont ternes et Sonic reste Sonic de
  base. La bascule passe d'une pierre à l'autre en vague (libéré : de la bleue vers le cercle,
  chacune s'illumine puis retombe sur son éclat ; scellé : en sens inverse, chacune brille une
  dernière fois puis s'éteint), avec un bruitage de Sonic 2 (`emeralds-unseal.mp3`,
  `emeralds-seal.mp3`, découpés à la main).

**Dates.** Toutes les dates affichées passent par `BRAND.timeZone` (`Europe/Paris`) : le serveur
Vercel tourne en UTC, les navigateurs des membres en France ; sans fuseau explicite, l'heure
affichée serait décalée et le rendu serveur différerait du rendu client (erreur d'hydratation).

**Erreurs, 404 et chargement** (`apps/web/app`).

- `error.tsx` (page entière) et `(platform)/error.tsx` (header et colonne gauche conservés) :
  message en français sans détail technique, boutons « Réessayer » (`retry()`) et « Accueil » ;
  l'erreur part dans la console. `global-error.tsx` couvre une panne du layout racine (son propre
  `<html>`, styles en ligne car sans `globals.css`).
- `not-found.tsx` : page introuvable aux couleurs du thème ; `forbidden.tsx` : 403.
- `(platform)/loading.tsx` : squelette discret. Limite de Next sans Cache Components : il ne
  s'affiche qu'une fois le layout `(platform)` chargé (session, notifications, solde, activité).

**Réponses des routes.** Les routes JSON privées répondent via `json()` (`apps/web/lib/route.ts`),
qui pose `cache-control: private, no-store`. `errorResponse` traduit les erreurs connues (401, 403,
400, 429, erreurs de jeu) et laisse les autres en 500 sans détail. Après une server action qui change
ce qu'affiche le layout (notification lue, avatar enregistré), `refresh()` de `next/cache`
rafraîchit le routeur client sans recharger la page.

**Vote du design des cartes** (`/cartes`, module `games/tcg`).

- Les propositions sont dans `games/tcg/src/designs.ts` (`DESIGNS`, 66 aujourd'hui). Leur numéro
  affiché est leur place dans la liste : on n'ajoute qu'à la fin et on ne renomme jamais un id
  (il est stocké avec chaque note).
- Une proposition garde le rendu sur lequel on l'a notée et commentée : une nouvelle vague ne
  modifie jamais un composant partagé en place, elle ajoute une option. Exemple : `SnapCard` a
  `firstWave` pour la n°17 (SR dans une fenêtre, SSR qui vole en éclats au survol, classes
  `tcg-shard`, `tcg-crack`, `tcg-drift`), les vagues suivantes ont la SR qui sort de la carte et la
  SSR lenticulaire.
- Onglets (`TABS` dans la page) : **Design** (les propositions en cours, `DESIGN_TAB`, montrées
  sans effet de rareté, plus les trois points de départ 39, 44 et 48, `REFERENCES`). Vague en
  cours (55 à 66, `ui/v4.tsx`) : titre en haut, et une grille fixe (titre, mana, puissance, ligne
  de type, texte) identique en carte normale et en full art ; en full art les encadrés sont
  translucides et floutés. Chaque ligne montre quatre versions : normale puis full art, puissance
  en bas à droite puis en haut à droite. Les 12 styles (`TOP_STYLES`) varient la fenêtre
  d'illustration (creusée, fondue, gravée, au niveau de la bordure, d'un bord à l'autre, arche,
  coins coupés, cadre fin), les encadrés (nuit, givre, parchemin, ardoise) et le titre (barre,
  plaque gravée, bandeau), **Effets de rareté** (`EFFECTS_TAB`) et **Variantes**, tous deux masqués pour
  l'instant (`hidden: true`), et **Archives**. Tant qu'un onglet est masqué, ses designs restent
  visibles et notables dans les Archives, dans une carte à part ; repasser `hidden` à false les
  renvoie dans leur onglet.
- Archives : seule la proposition ouverte (`?voir=<id>`) rend sa planche, les autres n'affichent que
  titre et résumé. `?masquer=1` cache ce que le membre a déjà noté (au moins une étoile ou un
  commentaire).
- Mots-clés lus dans les commentaires **des admins** (`commentTags`) : « à supprimer » envoie le
  design à la corbeille (en bas des Archives), « variant » le range dans les variantes à ressortir
  plus tard. Accents et majuscules ignorés ; un mot-clé précédé d'une négation dans le même membre
  de phrase (« pas à supprimer », « plutôt qu'une variante ») ne compte pas.
- Tout membre vote (server action `rateDesignAction`, `actionMember`) et voit les avis des autres.
  L'export JSON des notes (`/api/admin/cards/votes`) reste réservé aux admins.
- Carte exemple : l'idée `SHOWCASE_IDEA_ID` (voir « Boîte noire »), image servie par
  `/api/cartes/exemple` (302 vers une URL présignée de 5 min, redirection gardée 4 min).
- Toutes les cartes affichent leurs informations d'emblée, rien n'apparaît au survol. Polices :
  seules celles de l'onglet Design sont préchargées (`cartes/fonts.ts`).

## Avatars et place

Chaque membre a un avatar pixel art composé à partir des sprites du projet LPC (Universal LPC
Spritesheet Character Generator). Seules ses données sont reprises (PNG, définitions JSON,
palettes), jamais son code (GPL) : le compositeur est fait maison.

**Import des assets** (`pnpm assets:import`, script `scripts/import-lpc.ts`, relançable).

- Clone partiel du repo LPC, épinglé sur un commit (`--ref` pour en changer), dans `.cache/lpc/`
  (gitignoré) : définitions, palettes et uniquement les PNG de base des 5 animations retenues
  (`idle`, `walk`, `sit`, `jump`, `emote`). Les variantes de couleur précalculées, rangées dans des
  sous-dossiers `<animation>/`, ne sont pas prises.
- La catégorie vient du `type_name` de chaque définition, traduit par `TYPE_TO_CATEGORY`
  (`packages/avatar-assets/import/lpc.ts`). Armes, boucliers, carquois, outils, bijoux, épaules,
  bras et les pièces secondaires (liserés, surcouches, accessoires de chapeau) sont écartés. Seules
  les têtes humaines masculine et féminine et 6 expressions de visage sont gardées
  (`ALLOWED_ITEMS`), avec nez et sourcils ; ni oreilles, ni têtes non humaines.
- Un élément n'est proposé pour une morphologie que si chacun de ses calques y existe avec les 5
  animations, au même nombre de frames que le corps de référence. Le script affiche chaque élément
  écarté avec sa raison.
- Sortie versionnée dans `packages/avatar-assets` : `sprites/` (les PNG retenus, à leur chemin LPC)
  et `data/` (`catalog.json`, `palettes.json`, `credits.json`, ignorés par Prettier).
- Les capes n'ont ni `sit`, ni `jump`, ni `emote` : elles sont admises par `ANIMATION_FALLBACKS`
  (`emote` reprend les frames d'`idle`, `sit` et `jump` ne les dessinent pas, comme le générateur
  LPC). Aucune robe ni aucun sac à dos ne remplit la règle des 5 animations.
- Morphologies : homme et femme seulement (`MORPHS`) ; les autres morphologies LPC (ado, enfant,
  musclé, enceinte) ne sont pas importées.

**Compositeur** (`packages/avatar`, même code dans le navigateur et sur le serveur).

- Config : `{ v: 1, morph, skin, eyes, items: { <catégorie>: { id, colors? } } }`. La peau et les
  yeux se choisissent une fois : tout emplacement de couleur du matériau `body` (corps, tête,
  visage) prend `skin`, tout emplacement `eye` prend `eyes`.
- Règles : un élément par catégorie, corps et tête obligatoires, une robe retire le pantalon,
  élément compatible avec la morphologie (et avec la tête pour les visages, dont le chemin contient
  `${head}`).
- Tous les calques des éléments choisis sont triés par zPos (tri stable), puis dessinés avec un
  palette swap : chaque teinte du dégradé de base du matériau est remplacée par la teinte de même
  rang de la couleur choisie.
- Sortie : une planche unique de 5 animations × 4 directions (haut, gauche, bas, droite), frames de
  64 px (`sheetLayout`).
- Lecture et écriture des PNG : `createImageBitmap` et canvas côté navigateur, sharp côté serveur
  (`@app/avatar/server`, déjà présent avec Next et compatible Vercel).
- `configHash` : SHA-256 du JSON canonique de la config, de la version du rendu et du commit LPC.

**Données** (module core) :

- `Avatar` : userId (PK), config (Json), configHash, sheetKey (`avatars/<userId>-<hash>.png`),
  phrase (facultative), updatedAt.
- `UserAvatarItem` : userId, itemId, acquiredAt. Vide pour l'instant : tous les éléments sont
  `unlock: "free"`, la validation exige déjà la possession des autres.

**Cycle de vie.**

- Première visite : `ensureAvatar` crée un avatar aléatoire mais cohérent (tête humaine assortie à
  la silhouette, couleurs naturelles), sans événement d'activité. Il recompose aussi la planche si
  le catalogue a été réimporté (empreinte différente) et supprime alors l'ancienne planche. Les
  membres pas encore revenus reçoivent le leur via `ensureMissingAvatars` : 5 à la fois, tirés au
  hasard et en parallèle (un échec n'empêche pas les autres), après la réponse du dashboard.
- Éditeur (`/avatar`) : aperçu composé dans le navigateur à partir de `public/avatar-assets`
  (copie des sprites faite par la tâche `generate` d'`apps/web`, gitignorée).
- Enregistrement (server action) : validation zod puis catalogue (`checkConfig`), composition,
  envoi dans R2 (`putObject`, `Cache-Control: immutable`), upsert, événement `avatar/updated`, puis
  suppression de l'ancienne planche. Même config : rien ne se passe.
- Phrase (`/avatar`, carte « Ma phrase », server action séparée) : `setAvatarPhrase` la ramène sur
  une ligne (retours à la ligne et caractères de contrôle → espaces, espaces réduits), refuse plus
  de `AVATAR_PHRASE_MAX` (60) caractères ; vide = pas de phrase. Pas d'événement d'activité : elle
  n'apparaît que sur la place. Changer d'avatar la garde.
- Lecture : `GET /api/avatars/[userId]/[hash]` (requireMember) vérifie que l'empreinte est la
  courante puis redirige (302) vers une URL GET présignée de 15 min. La redirection est gardée
  10 min (`private, max-age=600`), moins longtemps que la validité de l'URL ; une nouvelle planche a
  toujours une nouvelle URL, grâce à l'empreinte.
- Vercel : `outputFileTracingIncludes` embarque `public/avatar-assets` dans les fonctions, qui
  composent les planches. Les sprites décodés sont gardés en mémoire dans un cache LRU borné à
  64 Mio (`DEFAULT_SPRITE_CACHE_BYTES`, `packages/avatar/src/server.ts`) : décodé, le catalogue
  entier pèserait ~450 Mo par instance.

**La place** (sous la grille des apps).

- Scène canvas qui remplit la hauteur restante de l'écran (280 px au moins), vue de dessus, décor dessiné en code (arbres, fontaine, bancs,
  chemin). Simulation 100 % locale (`ui/place/sim.ts`) : chaque navigateur a sa propre scène.
- Errance : marcher vers un point (horizontale puis verticale, donc 4 directions), pause, repartir.
  Tri d'affichage par position verticale, décor compris.
- Membres inactifs depuis plus de 3 jours (dernier événement ou dernière session) : assis, « zzz ».
- Survol : pseudo. Clic : saut et bulle (sa phrase s'il en a une, sinon une réplique au hasard).
- Phrase du membre : son personnage la dit 5 s, une première fois dans les 25 s après l'affichage,
  puis toutes les 30 à 75 s (pas quand il dort, sans couper une autre bulle), et tout de suite
  quand elle change. Bulle trop large pour la scène : tronquée par « … ».
- `GET /api/place?since=` (requireMember) renvoie les membres (URL de leur planche, phrase,
  dernière activité) et les événements depuis `since` (10 min au plus). Le client l'appelle toutes les 30 s :
  un avatar modifié change de planche sans recharger la page, et chaque événement déclenche une
  réaction (`REACTIONS` : `avatar/updated` → émotion, 3 sur 3 à TROIS → confettis…).
  - `listEventsSince` reprend 10 s avant `since` (`EVENT_COMMIT_GRACE_MS`) : un événement validé
    après coup n'est pas perdu. Le prochain `since` est la date du dernier événement livré, et la
    place ne joue chaque événement qu'une fois (dédoublonnage par id).
  - Seuls les champs utiles aux réactions sont relayés (`PLACE_PAYLOAD_FIELDS`), jamais le payload
    brut des événements.
- Pause quand l'onglet est caché (requestAnimationFrame, et pas d'appel réseau). Si l'appareil
  demande moins d'animations : personnages immobiles, ni saut ni confettis. Scène `aria-hidden` :
  les mêmes informations sont dans le fil d'activité.

**Crédits.** `/credits` liste chaque élément importé (auteurs, licences, liens) depuis
`credits.json`, avec le lien vers le repo LPC et le commit importé. Lien depuis la place.

## Tests (Vitest)

- **economy** (sur un vrai Postgres) :
  - même clé d'idempotence = un seul crédit ;
  - débits concurrents sans solde négatif ;
  - le solde est égal à la somme du ledger ;
  - le trigger bloque bien UPDATE et DELETE.
- **ideas** :
  - un non-admin reçoit 403 sur la lecture d'une idée ou d'une image ;
  - validation des entrées ;
  - plafond de 30 demandes d'envoi d'image par heure, purge des uploads abandonnés ;
  - image dont le type ne correspond pas à celui annoncé refusée ;
  - idée exemple (`SHOWCASE_IDEA_ID`) lisible sans être admin, aucune autre ;
  - clé R2 générée côté serveur, et refus d'une clé fournie par le client ou émise pour un autre
    utilisateur.
- **avatars** :
  - import : un élément sans l'une des 5 animations, sans la morphologie ou au mauvais nombre de
    frames est écarté ; les calques multiples gardent leur zPos ;
  - compositeur : ordre des calques par zPos, éléments multi-calques, robe qui retire le
    pantalon, peau appliquée au corps et à la tête ;
  - validation : élément inexistant, incompatible ou non possédé, couleur hors palette refusés ;
  - empreinte : même config, même hash ; config modifiée, nouveau hash ;
  - enregistrement : planche dans R2, événement, ancienne planche supprimée.
- **accès** :
  - un non-membre du serveur Discord est refusé partout ;
  - la session est révoquée après la revérification ; une panne Discord ne révoque qu'après 24 h ;
  - un membre ne peut pas changer son pseudo ou son image par l'API Better Auth ;
  - chaque route et chaque page est bien protégée (`apps/web/test/access.test.ts`).
- **db** : contrôle des frontières (SQL brut, toute méthode Prisma, destructuration, types,
  imports dynamiques) et faux positifs écartés.
- **storage** : clés, présignatures, objets (sur le stockage S3 local).
- **jeux** : voir les README de TROIS et d'Agents Doubles ; **tcg** : vote ouvert aux membres,
  numéros stables, mots-clés et négations.

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
- [x] 9. Avatars pixel art (assets LPC, compositeur, éditeur) et place du dashboard.
- [x] 10. `games/agents` : Agents Doubles, jeu coopératif à deux, tour par tour, classement des
      duos.
- [x] 11. `games/tcg` : vote du design des cartes ouvert aux membres (`/cartes`), Ma monnaie
      (`/wallet`), exports JSON admin.
- [x] 12. Audit du 2026-10-25 : sécurité (profil, panne Discord), déploiement, pages d'erreur,
      fuseau horaire, limites d'envoi, corrections des jeux.

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
