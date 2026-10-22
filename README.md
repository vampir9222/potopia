# Plateforme de mini-jeux pour un serveur Discord

Un portail web réservé aux membres d'un serveur Discord : connexion avec Discord, monnaie interne,
fil d'activité, notifications, boîte à idées, et des jeux (le premier est **TROIS**, un Wordle
français à 3 mots par jour). Le nom affiché et celui de la monnaie viennent de
`packages/config/brand.ts`.

- Choix techniques et règles d'architecture : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Étapes de réalisation : [docs/ROADMAP.md](docs/ROADMAP.md)

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
| `pnpm db:deploy`        | Applique les migrations existantes (prod)                                 |
| `pnpm db:reset:test`    | Remet à zéro la base de test                                              |

La CI GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml)) lance format, lint,
typecheck, frontières, tests (avec Postgres et stockage réels) et build à chaque push.

---

## Organisation du code

```
apps/web/        app Next : pages, layouts, server actions, routes API (fines, sans logique métier)
packages/
  config/        tsconfig, ESLint, brand.ts (nom et monnaie)
  db/            client Prisma partagé, assemblage des schémas, migrations, contrôle des frontières
  core/          auth Discord, accès, utilisateurs, registre des apps, activité, notifications
  economy/       monnaie : ledger en ajout seul, wallets
  ideas/         boîte à idées (lue par les admins seulement)
  storage/       client S3/R2 et URLs présignées
  ui/            thèmes et composants de base
games/
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
   - `@source "../../../games/monjeu/ui";` dans `app/globals.css` ;
   - routes `app/api/monjeu/*` qui commencent par `requireMember(request.headers)` et page
     `app/(platform)/monjeu/page.tsx` avec `getCurrentMember()` ;
   - libellé dans `components/Breadcrumb.tsx`, et ces routes ajoutées à `test/access.test.ts`.
6. **Tuile** : une entrée dans `packages/core/src/apps/registry.ts` (et son icône lucide dans
   `packages/core/ui/AppGrid.tsx`).
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

### Ajouter un thème

Un bloc `[data-theme="montheme"]` de variables CSS dans `packages/ui/theme.css` (couleurs, dégradés,
police des titres, décors) et une entrée dans `packages/ui/src/themes.ts`. Le sélecteur du header le
propose aussitôt.

---

## Déployer (Vercel + Neon + R2)

1. **Base Neon** : créer un projet, récupérer l'URL **poolée** (`DATABASE_URL`) et l'URL **directe**
   (`DIRECT_URL`). Appliquer les migrations depuis un poste, avec `DIRECT_URL` pointant sur Neon :
   `pnpm db:deploy`. À refaire à chaque nouvelle migration, avant de déployer le code qui en dépend.
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
  présignées de 5 minutes ; la base ne stocke que leur clé.
