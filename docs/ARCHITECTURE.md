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
- `TcgSet` : code (unique, `S1`), name, createdAt. Une édition de cartes.
- `TcgCard` : setId, number (`(set_id, number)` unique), name, rarity (enum `TcgRarity` :
  common, uncommon, rare, epic, legendary, sr, ssr), type, family?, cost (0 à 6), power, effectKey?,
  effectParams? (JSON), effectText, flavor?, imageKey?, imageFrame? (JSON : cadrage de
  l'illustration, point central x/y en % et zoom de 1 à 4 ; l'image n'est jamais rognée), ideaId? (unique, `ideas.ideas` sans
  relation), baseCardId? (variante full art → sa carte de base), createdAt, updatedAt. La base ne
  contient aucune logique d'effet : seulement la clé d'un effet du catalogue et ses réglages.

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
- Les jeux gardent leur propre style pour l'instant (TROIS, Agents Doubles, cartes du vote) : une
  feuille CSS par jeu (`games/*/ui/*.css`), importée dans `apps/web/app/globals.css`.

**Header** (`packages/core/ui/Header.tsx`, boutons passés par `(platform)/layout.tsx`). De gauche à
droite : Luffy, la boule musicale, thème, cloche, volume, menu du profil.

- Luffy (`apps/web/components/LuffyRun.tsx`, masqué sous 640 px) et la boule
  (`components/SpinOrb.tsx`) lancent une animation et une musique en boucle au clic, et se mettent
  en pause au second.
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

- Les propositions sont dans `games/tcg/src/designs.ts` (`DESIGNS`, 71 aujourd'hui). Leur numéro
  affiché est leur place dans la liste : on n'ajoute qu'à la fin et on ne renomme jamais un id
  (il est stocké avec chaque note).
- Une proposition garde le rendu sur lequel on l'a notée et commentée : une nouvelle vague ne
  modifie jamais un composant partagé en place, elle ajoute une option. Exemple : `SnapCard` a
  `firstWave` pour la n°17 (SR dans une fenêtre, SSR qui vole en éclats au survol, classes
  `tcg-shard`, `tcg-crack`, `tcg-drift`), les vagues suivantes ont la SR qui sort de la carte et la
  SSR lenticulaire.
- Onglets (`TABS` dans la page) : **Design** (les propositions en cours, `DESIGN_TAB`, montrées
  sans effet de rareté, plus des points de départ repliés, `REFERENCES`, vide aujourd'hui). Vague en
  cours (n°67 à 71, `ui/v5.tsx`, `FinalCard`) : le 65 affiné. Bandeau du titre et encadrés
  ardoise du 65, cadre fin (7 px) du 66, puissance en bas à droite ; le bandeau est au plan de la
  bordure et passe dessous, pour épouser le cadre. Dans l'encadré, l'effet en haut et la
  description en italique plus petite en bas. En pied de carte : numéro, rareté et étoiles
  (`RARITY_STARS` : 1 pour la légendaire, 2 pour la SR, 3 pour la SSR), précédés du code du set
  (« S1 07/116 »). Pas de symbole d'édition : la rareté se voit au cadre (`RARITY_FRAME` : argent,
  vert, bleu, violet (épique), or, nacre, arc-en-ciel), uni et sans lumière venant d'un côté pour une épaisseur égale
  tout autour, puis aux effets. Bandeau court (n°70) : titre à la hauteur du mana, centré sur toute la
  largeur de la carte ; la planche du n°70 montre aussi les sept raretés. Le n°67 (`final-bandeau`) a le bandeau plein et
  se montre dans chaque rareté ; les n°68 à 71 (`BAND_DESIGNS`, `BandShape`) essaient d'autres
  formes de bandeau autour du mana : échancré, mana serti dans un anneau de métal, bandeau court
  (le mana déborde dessous), sans bandeau. Seul le n°70 (bandeau court), retenu pour l'instant,
  est dans l'onglet Design ; les autres sont aux Archives. Vague précédente (55 à 66,
  `ui/v4.tsx`, aux Archives) : titre en haut, grille fixe identique en normale et en full art,
  quatre versions par ligne (puissance en bas ou en haut) ; les 12 styles (`TOP_STYLES`) varient
  la fenêtre, les encadrés (nuit, givre, parchemin, ardoise) et le titre (barre, plaque gravée,
  bandeau). Puis **Effets de rareté** (`EFFECTS_TAB`) et **Variantes**, tous deux masqués pour
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

**Cartes du jeu** (`/admin/cartes`, module `games/tcg`). Structure décidée le 2026-10-30
(document « Potopia TCG — structure finale ») : rareté fixe portée par la carte, sets, variantes
full art qui reprennent les stats de leur carte de base. Pour l'instant, seuls les admins lisent
et modifient les cartes.

- Catalogue d'effets (`games/tcg/src/effects.ts`, `EFFECTS`, 48 effets) : chaque effet a une clé,
  un moment (à la révélation, permanent, fin de tour, quand elle est détruite), des réglages
  (nombre borné, famille ou nom de jeton, validés par `paramsSchema`), un modèle de texte
  (`effectText`) et, souvent, la carte de Marvel Snap qui l'inspire (`snap`, affichée dans
  l'éditeur : Iron Man, Wong, Sera, Armor, Shang-Chi, Killmonger, Deadpool…). L'admin choisit
  l'effet d'une carte dans cette liste et règle ses nombres, sans déploiement ; un effet nouveau
  s'ajoute dans le code.
- `games/tcg/src/cards.ts` : `listSets`, `ensureSet`, `listCards`, `getCard`, `createCard`
  (numéro suivant du set, sous verrou), `updateCard`, `createCardImageUpload` (PUT présigné,
  clé `cards/<uuid>.<ext>`, 5 Mo), `setCardImage` (vérifie l'objet), `importCards`. Toutes
  prennent l'admin en premier argument et lèvent `ForbiddenError` sinon. Constantes sans
  dépendance serveur dans `src/card-rules.ts` (importables côté navigateur).
- Variante (`baseCardId`) : elle reprend mana, puissance, type, famille et effet de sa carte de
  base ; `updateCard` sur la carte de base les lui recopie, et sur la variante ne change que le
  nom, la rareté et la description. Pas de variante d'une variante.
- Import (`/admin/cartes/import`, `importCards`) : fichier JSON `{ set: { code, name }, cards }`.
  Le set est créé au besoin, les cartes prennent les numéros suivants ; une carte dont l'idée a
  déjà une carte est ignorée (réimporter ne crée pas de doublon et n'écrase pas les
  modifications). Tout ou rien, avec la carte fautive dans le message. Les fichiers de cartes
  générées depuis les idées ne vont jamais dans le dépôt (contenu des membres).
- Pages : `/admin/cartes` (planche du set, `?set=<code>`), `/admin/cartes/[id]` et
  `/admin/cartes/nouvelle` (`CardEditor` : formulaire et aperçu en direct, normale ou full art,
  envoi d'illustration), `/admin/cartes/import`, `/admin/cartes/illustrations` (`CardImagesUpload` :
  plusieurs images d'un coup, chacune posée sur la carte dont elle porte le numéro, « 12.jpg »). Les cartes s'affichent dans le design retenu
  (n°70, `GameCard`, ligne de type « {type} — {famille} »).
- Cadrage : sous l'aperçu de l'éditeur, `ImageFramer` montre la fenêtre d'illustration (normale ou
  full art) ; on y fait glisser l'image et on règle le zoom, le cadrage est enregistré avec la
  carte et appliqué partout où elle s'affiche (`frameStyle`).
- Illustration : `GET /api/admin/cards/[id]/image` (admin, 302 vers une URL présignée de 5 min),
  celle de la carte ou, à défaut, celle de son idée (`listIdeaIdsWithImage` dit lesquelles en
  ont une).

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
- [ ] 13. `games/tcg` : cartes du jeu (sets, cartes, catalogue d'effets, admin `/admin/cartes`,
      import), puis boosters, collection, decks et parties.

## Hors périmètre (pour l'instant)

Côté cartes : boosters, collection, decks et parties (étape 13, à venir). Pas de récompense en
monnaie dans TROIS pour l'instant.

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
