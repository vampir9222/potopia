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
  - Seules
    les 9 têtes humaines adultes sont gardées (`ALLOWED_HEADS`), avec nez, sourcils et oreilles
    humaines ou elfiques (les oreilles d'animaux sont dans `EXCLUDED_ITEMS`).
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
  updatedAt.
- `UserAvatarItem` : userId, itemId, acquiredAt. Vide pour l'instant : tous les éléments sont
  `unlock: "free"`, la validation exige déjà la possession des autres.

**Cycle de vie.**

- Première visite : `ensureAvatar` crée un avatar aléatoire mais cohérent (tête humaine assortie à
  la silhouette, couleurs naturelles), sans événement d'activité. Il recompose aussi la planche si
  le catalogue a été réimporté (empreinte différente). Les membres pas encore revenus reçoivent le
  leur via `ensureMissingAvatars`, quelques-uns à la fois, après la réponse du dashboard.
- Éditeur (`/avatar`) : aperçu composé dans le navigateur à partir de `public/avatar-assets`
  (copie des sprites faite par la tâche `generate` d'`apps/web`, gitignorée).
- Enregistrement (server action) : validation zod puis catalogue (`checkConfig`), composition,
  envoi dans R2 (`putObject`, `Cache-Control: immutable`), upsert, événement `avatar/updated`, puis
  suppression de l'ancienne planche. Même config : rien ne se passe.
- Lecture : `GET /api/avatars/[userId]/[hash]` (requireMember) vérifie que l'empreinte est la
  courante puis redirige (302) vers une URL GET présignée de 15 min. La redirection est gardée
  10 min (`private, max-age=600`), moins longtemps que la validité de l'URL ; une nouvelle planche a
  toujours une nouvelle URL, grâce à l'empreinte.
- Vercel : `outputFileTracingIncludes` embarque `public/avatar-assets` dans les fonctions, qui
  composent les planches.

**La place** (sous la grille des apps).

- Scène canvas de 280 px de haut, vue de dessus, décor dessiné en code (arbres, fontaine, bancs,
  chemin). Simulation 100 % locale (`ui/place/sim.ts`) : chaque navigateur a sa propre scène.
- Errance : marcher vers un point (horizontale puis verticale, donc 4 directions), pause, repartir.
  Tri d'affichage par position verticale, décor compris.
- Membres inactifs depuis plus de 3 jours (dernier événement ou dernière session) : assis, « zzz ».
- Survol : pseudo. Clic : saut et petite bulle.
- `GET /api/place?since=` (requireMember) renvoie les membres (URL de leur planche, dernière
  activité) et les événements depuis `since` (10 min au plus). Le client l'appelle toutes les 30 s :
  un avatar modifié change de planche sans recharger la page, et chaque événement déclenche une
  réaction (`REACTIONS` : `avatar/updated` → émotion, 3 sur 3 à TROIS → confettis…).
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
  - limite d'envois ;
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
- [x] 9. Avatars pixel art (assets LPC, compositeur, éditeur) et place du dashboard.

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
