# Plateforme de mini-jeux pour un serveur Discord

Un portail web réservé aux membres d'un serveur Discord : connexion avec Discord, monnaie interne
(« Ma monnaie »), fil d'activité, notifications, avatars pixel art qui se promènent sur une place
commune (et y disent la phrase choisie par leur membre), boîte à idées, vote du design des futures cartes, et deux jeux : **TROIS** (un Wordle
français à 3 mots par jour) et **Agents Doubles** (jeu d'espions coopératif à deux). Le nom affiché
et celui de la monnaie viennent de `packages/config/brand.ts`.

- Choix techniques et règles d'architecture : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Étapes de réalisation : [docs/ROADMAP.md](docs/ROADMAP.md)
- Intégration de GOTY Party (planifiée, pas encore disponible) :
  [plan d’action](docs/PLAN_INTEGRATION_GOTY_PARTY.md) et
  [contrat fonctionnel](docs/CONTRAT_FONCTIONNEL_GOTY_PARTY.md).
  Le [socle serveur](games/goty/README.md) est implémenté, sans page ni route HTTP pour l’instant.

**Stack** : monorepo pnpm + Turborepo, TypeScript strict, Next.js 16 (App Router), Tailwind v4,
PostgreSQL + Prisma 7, Better Auth (Discord), stockage S3 (Cloudflare R2 en prod, RustFS en
local), Vitest. Hébergement prévu : Vercel + Neon + R2.

---

## Lancer le projet en local

### Prérequis

- **Node.js 22 ou plus** (24 recommandé) et **pnpm 10** : `corepack enable` installe la bonne
  version de pnpm (déclarée dans `package.json`).
- **Docker Desktop**, lancé : il fait tourner Postgres et le stockage S3 local.
- Une **application Discord** (gratuite), voir [Configurer Discord](#configurer-discord).
- Sous Windows : le projet doit être sur un **disque local**. Un partage réseau refuse les liens
  symboliques dont pnpm a besoin.

### Étapes

```sh
pnpm install
cp .env.example .env        # puis remplir les variables Discord et BETTER_AUTH_SECRET (voir plus bas)
pnpm db:up                  # Postgres (port 5433) + stockage S3 local (port 9000)
pnpm storage:init           # crée le bucket local et son CORS (une seule fois)
pnpm db:migrate             # crée les tables
pnpm dev                    # http://localhost:3000
```

La console du stockage local est sur http://localhost:9001 (identifiants dans `.env.example`).

### Variables d'environnement

Toutes sont décrites dans [.env.example](.env.example). En local, seules celles marquées « à
remplir » demandent une action.

| Variable                                    | Rôle                                                                     | En local                         |
| ------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------- |
| `DATABASE_URL`                              | Base de l'application (URL poolée en prod)                               | déjà rempli (Docker)             |
| `DIRECT_URL`                                | Base pour les migrations (URL directe en prod)                           | déjà rempli (Docker)             |
| `TEST_DATABASE_URL`                         | Base des tests, **vidée** par les tests (son nom doit finir par `_test`) | déjà rempli (Docker)             |
| `BETTER_AUTH_SECRET`                        | Secret de session (32+ caractères aléatoires)                            | **à remplir** (commande fournie) |
| `BETTER_AUTH_URL`                           | URL publique de l'app                                                    | `http://localhost:3000`          |
| `DISCORD_CLIENT_ID` / `_SECRET`             | Identifiants de l'application Discord                                    | **à remplir**                    |
| `DISCORD_GUILD_ID`                          | ID du serveur : seuls ses membres peuvent se connecter                   | **à remplir**                    |
| `ADMIN_DISCORD_IDS`                         | IDs Discord des admins, séparés par des virgules                         | **à remplir** (le tien)          |
| `R2_ENDPOINT`                               | Endpoint S3 explicite ; vide en prod (endpoint R2 du compte)             | `http://localhost:9000`          |
| `R2_ACCOUNT_ID`                             | Compte Cloudflare (ignoré si `R2_ENDPOINT` est rempli)                   | vide                             |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | Clés d'accès au bucket                                                   | déjà rempli (local)              |
| `R2_BUCKET`                                 | Bucket privé des images                                                  | `app-local`                      |
| `VERCEL_ENV` / `DATABASE_URL_UNPOOLED`      | Fournies par Vercel (environnement, URL directe Neon) : rien à déclarer  | absentes                         |

Toute nouvelle variable va dans `.env.example` (documentée) et dans `globalPassThroughEnv` de
`turbo.json`. Le fichier `.env` n'est jamais versionné.

---

## Configurer Discord

Tout se fait sur une seule page du [Developer Portal](https://discord.com/developers/applications),
une fois pour toute l'équipe.

1. **New Application**, puis l'onglet **OAuth2**.
2. Section **Redirects** → **Add Redirect** :
   - en local : `http://localhost:3000/api/auth/callback/discord`
   - en prod : `https://<projet>.vercel.app/api/auth/callback/discord`

   Puis **Save Changes**. Les deux adresses peuvent coexister.

3. En haut de la page OAuth2 : **Client ID** → `DISCORD_CLIENT_ID`, **Reset Secret** →
   `DISCORD_CLIENT_SECRET`. Le secret n'est affiché qu'une fois ; il ne se partage pas (ni chat ni
   code).
4. Dans l'app Discord, activer le mode développeur (Paramètres → Avancés), puis :
   - clic droit sur le serveur → « Copier l'identifiant du serveur » → `DISCORD_GUILD_ID` ;
   - clic droit sur ton pseudo → « Copier l'identifiant de l'utilisateur » → `ADMIN_DISCORD_IDS`.

Pas de bot : la connexion demande les scopes `identify email guilds` et vérifie l'appartenance au
serveur à la connexion, puis toutes les 6 heures.

---

## Commandes

| Commande                | Effet                                                                     |
| ----------------------- | ------------------------------------------------------------------------- |
| `pnpm dev`              | App web en développement sur http://localhost:3000                        |
| `pnpm build`            | Build de production                                                       |
| `pnpm lint`             | ESLint sur tout le monorepo                                               |
| `pnpm typecheck`        | TypeScript sur tout le monorepo                                           |
| `pnpm test`             | Tests (Docker lancé), un package après l'autre : ils partagent `app_test` |
| `pnpm check:boundaries` | Vérifie qu'aucun module n'accède aux tables d'un autre                    |
| `pnpm format`           | Prettier                                                                  |
| `pnpm db:up`            | Lance Postgres et le stockage S3 locaux (Docker)                          |
| `pnpm storage:init`     | Crée le bucket local et son CORS                                          |
| `pnpm db:migrate`       | Crée une migration à partir des `schema.prisma` et l'applique (dev)       |
| `pnpm db:deploy`        | Applique les migrations existantes (prod, fait par le build Vercel)       |
| `pnpm db:reset:test`    | Remet à zéro la base de test                                              |
| `pnpm assets:import`    | Réimporte les sprites LPC des avatars (`--ref <commit>` pour en changer)  |

La CI GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml)) lance format, lint,
typecheck, frontières, tests (avec Postgres et stockage réels) et build du site sur chaque pull
request vers `main`, qui est protégée. Le déploiement est fait par Vercel : en production, il
applique les migrations après le build (voir « Déployer »).

---

## Organisation du code

```
apps/web/        app Next : pages, layouts, server actions, routes API (fines, sans logique métier)
packages/
  config/        tsconfig, ESLint, brand.ts (nom et monnaie)
  db/            client Prisma partagé, assemblage des schémas, migrations, contrôle des frontières
  core/          auth Discord, accès, utilisateurs, registre des apps, activité, notifications,
                 avatars (config, planche composée dans R2, place)
  avatar/        compositeur d'avatars LPC (client et serveur), éditeur, place du dashboard
  avatar-assets/ sprites LPC importés, catalogue, palettes et crédits (pnpm assets:import)
  economy/       monnaie : ledger en ajout seul, wallets
  ideas/         boîte à idées (lue par les admins seulement ; une idée exemple visible de tous
                 sur /cartes)
  inventory/     inventaire des membres : Émeraudes du Chaos cachées sur le site (puis hauts faits)
  storage/       client S3/R2 et URLs présignées
  ui/            thèmes et composants de base
games/
  agents/        Agents Doubles, le jeu d'espions coopératif à deux
  goty/          GOTY Party : socle serveur (éditions, accès, inscrits), interface à venir
  tcg/           jeu de cartes : vote du design (/cartes), cartes et effets (admin /admin/cartes)
  trois/         TROIS, le Wordle à 3 mots par jour
```

Chaque module (`core`, `economy`, `ideas`, chaque jeu) a son `schema.prisma` dans un schéma
Postgres à son nom, son code serveur dans `src/` et ses composants React dans `ui/`. Les règles qui
ne se négocient pas sont dans [CLAUDE.md](CLAUDE.md) et détaillées dans l'architecture, notamment :

- un module n'accède jamais aux tables d'un autre (`pnpm check:boundaries` le vérifie) ;
- toute fonction d'écriture accepte `{ tx }` pour se composer dans une transaction ;
- pas d'import de Next dans `packages/*` et `games/*` ;
- chaque page, server action et route vérifie les droits côté serveur.

---

## Ajouter un jeu ou une app

Exemple pour un jeu `games/monjeu` :

1. **Package** : `games/monjeu/package.json` nommé `@app/monjeu` (s'inspirer de
   `games/trois/package.json`), avec `tsconfig.json` et `eslint.config.js` copiés d'un autre module.
2. **Données** : `games/monjeu/schema.prisma`, modèles préfixés (`MonjeuPartie`) et
   `@@schema("monjeu")`. Ajouter `"monjeu"` à la liste `schemas` de `packages/db/prisma/base.prisma`,
   puis `pnpm db:migrate --name monjeu`. Les utilisateurs sont référencés par une simple colonne
   `user_id`, sans relation.
3. **Logique** dans `src/` : fonctions d'écriture de la forme `fn(input, opts?: { tx?: DbTx })`,
   validation zod des entrées, tests Vitest dans `test/`.
4. **Interface** dans `ui/` (React pur, `"use client"` si besoin d'état).
5. **Branchement dans `apps/web`** :
   - dépendance `"@app/monjeu": "workspace:*"` et entrée dans `transpilePackages` de
     `next.config.ts` ;
   - `@source "../../../games/monjeu/ui";` dans `app/globals.css`, et
     `@import "@app/monjeu/ui/monjeu.css";` si le jeu a sa propre feuille de style (exportée dans
     son `package.json`) ;
   - routes `app/api/monjeu/*` qui commencent par `requireMember(request.headers)` et répondent
     avec `json()` de `lib/route.ts` (jamais mises en cache), et page
     `app/(platform)/monjeu/page.tsx` avec `getCurrentMember()` ;
   - ces routes et la page ajoutées à `test/access.test.ts`.
6. **Tuile** : une entrée dans `packages/core/src/apps/registry.ts`. Son icône : un nom ajouté à
   l'union `AppIconName` du même fichier, et l'icône lucide correspondante dans `ICONS` de
   `packages/core/ui/AppGrid.tsx`. Le fil d'Ariane reprend le nom de la tuile tout seul.
7. `pnpm install`, puis redémarrer `pnpm dev`. Si Next ne trouve pas le package, vider
   `apps/web/.next/dev`.

### Utiliser la monnaie, l'activité et les notifications

Un jeu n'écrit jamais dans les tables des autres modules : il appelle leurs fonctions, dans sa
propre transaction s'il le faut.

```ts
import { notify, publishEvent } from "@app/core";
import { withTx } from "@app/db";
import { credit } from "@app/economy";

await withTx(async (tx) => {
  // … écritures du jeu avec tx …
  await credit(
    { userId, amount: 50, reason: "Victoire", idempotencyKey: `monjeu:${partieId}:gain` },
    { tx },
  );
  // Visible par tous : un score ou un compteur, jamais de contenu privé.
  await publishEvent({ userId, app: "monjeu", type: "victoire", payload: { score: 12 } }, { tx });
  await notify({ userId, title: "Tu as gagné 50 pièces !", link: "/monjeu" }, { tx });
});
```

- `idempotencyKey` : une clé stable par opération ; rejouer la même opération ne crédite qu'une
  fois. `debit` lève `InsufficientFundsError` si le solde ne suffit pas.
- La phrase affichée dans le fil d'activité se déclare dans `apps/web/lib/activity.ts`.
- La réaction des avatars de la place (saut, émotion, confettis, bulle) se déclare dans
  `REACTIONS` de `packages/avatar/ui/place/reactions.ts` ; par défaut, l'auteur saute.

### Jouer des sons

Le bouton volume du header règle tous les sons du site. Un son doit le respecter : `effectiveVolume()`
de `@app/ui` donne le volume à appliquer (0 à 1, 0 si coupé) et `onVolumeChange(fn)` prévient quand
il change. Pour un `<audio>` : `audio.volume = effectiveVolume()` (exemples : la boule musicale du
header, `apps/web/components/SpinOrb.tsx`, qui joue `public/audio/spin2.mp3`, Luffy,
`components/LuffyRun.tsx`, qui joue `public/audio/luffy.mp3`, Sonic, `components/SonicRun.tsx`,
et l'arrêt sur image « To Be Continued », `components/ToBeContinued.tsx`) ; avec Web Audio : un
`GainNode` en fin de chaîne (voir `games/trois/ui/sound.ts`).

### Ajouter un thème

Un bloc `[data-theme="montheme"]` de variables CSS dans `packages/ui/theme.css` (couleurs, dégradés,
police des titres, décors) et une entrée dans `packages/ui/src/themes.ts`. Le sélecteur du header le
propose aussitôt. Une police de titres vient de `next/font/google` dans `apps/web/app/layout.tsx`
(variable CSS, comme `--font-onepiece-face`) ; un décor animé est un composant de `packages/ui`
monté dans ce layout et affiché par une variable du thème (exemples : `JojoDecor` et `--jojo`,
`OnePieceDecor` et `--onepiece`).

### Ajouter ou modifier des cartes

Les cartes se gèrent dans **Administration › Cartes** (`/admin/cartes`, 24 cartes par page, avec
une recherche par nom, famille ou effet qui se met à jour pendant la frappe). Les cartes attendent
dans la réserve (la page s'ouvre dessus) ; une carte rangée dans un set y prend un numéro et ira en
prod avec lui. Depuis la page
d'une idée (Administration › Boîte à idées), « Créer une carte » pré-remplit une carte. On y règle : nom, type, famille,
mana, puissance, rareté, effet (choisi dans le catalogue `games/tcg/src/effects.ts`, puis réglé),
description et illustration (à envoyer, puis à cadrer en la faisant glisser et en zoomant). Pour en créer beaucoup d'un coup, `/admin/cartes/import` prend un
fichier JSON (format affiché sur la page ; un fichier `updates` y change en masse le coût, la
puissance et l'effet de cartes existantes), et `/admin/cartes/illustrations` plusieurs images d'un
coup (chaque fichier porte le numéro de sa carte : `12.jpg`). Les cartes générées à partir des
idées restent hors du dépôt, puisqu'elles reprennent le contenu des membres. Un effet nouveau s'ajoute dans
`effects.ts` (clé, moment, réglages, texte, carte Marvel Snap reprise) et devient disponible pour
toutes les cartes : chaque effet reprend une vraie carte Snap, déjà équilibrée.

### Mettre à jour la mascotte

La mascotte a le visage d'un membre : ses images ne sont pas dans le dépôt. Elles s'envoient dans
**Administration › Mascotte** (`/admin/mascotte`) : le corps (512 × 673 px, fond transparent, sans
la couronne) et la couronne (102 × 92 px environ), en PNG ou WebP. Tant que rien n'est envoyé, le
site affiche les icônes habituelles à sa place. Un dessin aux proportions différentes demande de
recaler les paupières et la couronne dans `apps/web/app/globals.css` (bloc « Mascotte »). Ses
phrases (bulle sur TROIS) s'éditent sur la même page, une par ligne ; elles ne sont pas dans le
dépôt non plus.

---

## Déployer (Vercel + Neon + R2)

1. **Base Neon** : créer un projet, récupérer l'URL **poolée** (`DATABASE_URL`) et l'URL **directe**
   (`DIRECT_URL`, ou `DATABASE_URL_UNPOOLED` fourni par l'intégration Neon de Vercel).
   **Migrations automatiques** : à chaque déploiement de **production**, le build de `apps/web`
   enchaîne `next build` puis la tâche `deploy:production` de `@app/db`
   ([scripts/deploy-production.ts](packages/db/scripts/deploy-production.ts)), qui lance
   `prisma migrate deploy`. Fusionner une PR qui contient une migration l'applique donc en prod, y
   compris les changements de tables existantes (colonne ajoutée, renommée, supprimée…). L'ordre
   compte : si le build du site échoue, la base n'a pas bougé ; si une migration échoue, le build
   échoue et la version en ligne reste en place. Les previews Vercel, la CI et le local
   n'appliquent rien. À la main si besoin, depuis un poste avec `DIRECT_URL` pointant sur Neon :
   `pnpm db:deploy`.
   **Migration en échec** : Prisma la note comme échouée et refuse tout déploiement suivant
   (erreur `P3009`). Corriger la migration (ou la base) à la main, puis, depuis un poste avec
   `DIRECT_URL` sur Neon, `pnpm --filter @app/db exec prisma migrate resolve --rolled-back <nom>`
   (ou `--applied` si elle avait en fait abouti), et relancer le déploiement depuis Vercel.
2. **Bucket R2 privé** : créer le bucket, puis un token API avec les droits « Object Read & Write »
   sur ce bucket (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ACCOUNT_ID`, `R2_BUCKET`). Laisser
   `R2_ENDPOINT` vide. Dans les réglages CORS du bucket :

   ```json
   [
     {
       "AllowedOrigins": ["https://<projet>.vercel.app"],
       "AllowedMethods": ["PUT", "GET"],
       "AllowedHeaders": ["content-type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

3. **Vercel** : importer le repo, **Root Directory** `apps/web`, Node.js 24. Garder la **Build
   Command** proposée par Vercel, `turbo run build` : lancée depuis `apps/web`, elle construit l'app
   et ses dépendances, génération du client Prisma comprise.
   Déclarer toutes les variables de `.env.example` (sauf `TEST_DATABASE_URL`), avec
   `BETTER_AUTH_URL=https://<projet>.vercel.app` et un `BETTER_AUTH_SECRET` propre à la prod.
4. **Discord** : ajouter la redirect URI de prod (voir plus haut).

---

## Sécurité et repo public

- Aucun secret dans le repo : `.env` est ignoré, `.env.example` ne contient que des valeurs
  locales fictives.
- Pas d'ID Discord réel, de domaine de prod ni de contenu de membre dans le code, la doc, les tests
  ou les messages de commit : placeholders uniquement (`<projet>.vercel.app`, `123456789012345678`).
- Les images de la boîte à idées sont dans un bucket privé, servies aux admins par des URLs
  présignées de 5 minutes (et, pour la seule idée exemple `SHOWCASE_IDEA_ID`, à tout membre via
  `/api/cartes/exemple`) ; la base ne stocke que leur clé. Les images envoyées puis abandonnées
  sont purgées au bout de 24 h.
- Les images de la mascotte (visage d'un membre) et ses phrases sont dans le même bucket privé,
  servies aux seuls membres connectés par `/api/mascotte/<partie>` et `/api/mascotte/phrases`.
- Pseudo, image et e-mail viennent de Discord : les endpoints de Better Auth qui permettraient de
  les changer depuis le site sont désactivés.
