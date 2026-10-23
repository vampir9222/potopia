# CLAUDE.md

Plateforme web de mini-jeux pour un groupe d'amis Discord. Monorepo pnpm + Turborepo, TypeScript
strict. Langue de l'UI et des docs : français.

- Architecture, modèle de données, décisions : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Plan de dev par étapes (cocher l'étape terminée) : [docs/ROADMAP.md](docs/ROADMAP.md)

## Commandes (depuis la racine)

```sh
pnpm install
pnpm dev | build | test | lint | typecheck   # dev : http://localhost:3000
pnpm format          # prettier --write
pnpm db:up           # Postgres (port 5433) + stockage S3 local RustFS (9000, console 9001) ; Docker Desktop lancé
pnpm storage:init    # crée le bucket local et son CORS (une fois après db:up)
```

Tests : Postgres local via `TEST_DATABASE_URL` (base `app_test`, vidée par les tests, donc packages
testés un par un : `turbo run test --concurrency=1`). API Discord toujours mockée.

## Règles non négociables

1. **Frontières de modules** : un module ne lit/écrit jamais les tables d'un autre, il appelle les
   fonctions exportées par ce module. Pas de FK ni de relation Prisma entre domaines (`userId` =
   simple colonne).
2. **Transactions composables** : toute fonction d'écriture a la signature
   `fn(input, opts?: { tx?: DbTx })`.
3. **Nom de marque** : uniquement via `packages/config/brand.ts` (`BRAND`, `formatCurrency`). Jamais
   en dur. Packages `@app/*`, schémas/tables à noms fonctionnels (`core`, `economy`, `ideas`).
4. **Pas d'import Next** (`next`, `next/*`) dans `packages/*` et `games/*` : ils doivent tourner hors
   Next (futur serveur temps réel). Server actions et route handlers vivent dans `apps/web`.
5. **Sécurité** : tous les contrôles de droits côté serveur (`requireMember()` / `requireAdmin()`
   dans chaque layout, server action et route handler ; `proxy.ts` n'est qu'optimiste). Admin =
   `ADMIN_DISCORD_IDS` lu depuis l'env.
6. **Aucun secret ni contenu réel dans le repo** : `.env` gitignoré, toute nouvelle variable va dans
   `.env.example` (documentée) et dans `globalPassThroughEnv` de `turbo.json`. Seeds = données
   fictives. Le repo est public : docs, tests, commentaires et messages de commit ne contiennent
   jamais d'ID Discord réel (serveur, admins, app), d'infos de prod (domaine, bucket R2, account
   Cloudflare, hôte Neon), ni pseudos, prénoms ou contenus des membres. Placeholders uniquement
   (`<projet>.vercel.app`, `123456789012345678`). Pas de faille connue non corrigée décrite en
   clair.
7. **R2 privé** : clés d'objet générées côté serveur, URLs présignées courtes, on stocke la clé en DB,
   jamais une URL.
8. **Ledger economy en ajout seul** : jamais d'UPDATE/DELETE sur `transactions` ; correction = transaction
   inverse.
9. **Boîte à idées = boîte noire** : aucun membre ne lit d'idée (même les siennes), aucun contenu
   d'idée dans l'activité, les notifications ou les logs.

## Conventions

- Validation des entrées avec zod, à la frontière (actions, route handlers, fonctions publiques).
- Chaque module : `schema.prisma` (schéma Postgres à son nom), code serveur, `ui/` en React pur.
- Versions : TypeScript 6.0 (typescript-eslint ne supporte pas la 7), Prisma 7.x (Better Auth exige
  `^7`). Versions de deps épinglées exactement.

## Git (GitHub Flow)

`main` = production (déployée par Vercel à chaque fusion), protégée par un ruleset : jamais de
push direct, PR obligatoire, check `ci` verte requise. Pas de branche `develop`.

Circuit d'un changement :

1. Partir de `main` à jour (`git checkout main && git pull`) et créer une branche courte :
   `feat/…`, `fix/…`, `chore/…` ou `docs/…`.
2. Faire les modifications et commiter. Avant de pousser : `pnpm format:check`, `lint`,
   `typecheck`, `check:boundaries` et `test` passent en local.
3. Pousser la branche (`git push -u origin <branche>`).
4. Ouvrir la PR vers `main`. Sans `gh`, via l'API GitHub avec la connexion de git (jeton obtenu par
   `git credential fill`, jamais affiché ni écrit sur disque ; corps JSON écrit en UTF-8 pour les
   accents).
5. Attendre la check `ci` de la PR. Rouge : corriger sur la branche et repousser.
6. Verte : fusionner en squash (titre = résumé du changement, suivi de `(#<n° PR>)`).
7. Revenir sur `main`, `git pull`, supprimer la branche locale (la distante est supprimée
   automatiquement).

Autorisations : les étapes 1 et 2 sont libres. Pousser, ouvrir la PR et fusionner (étapes 3 à 6)
seulement quand l'utilisateur le demande (« fais la PR », « fusionne »…), sauf autorisation
permanente notée ici.

**Migrations** : le build Vercel de production applique les migrations (`prisma migrate deploy`,
tâche `build` de `@app/db`) : fusionner une PR qui en contient une la passe en prod, sans étape
manuelle. Donc : ne jamais modifier une migration déjà fusionnée (en créer une nouvelle) ; toute
migration qui modifie ou supprime de l'existant (colonne renommée ou supprimée, contrainte ajoutée
sur des données en place, table supprimée) est signalée en tête de la PR, avec ce qu'elle fait aux
données, et n'est fusionnée qu'avec l'accord explicite de l'utilisateur. Une migration qui ajoute
seulement (schéma, table, colonne facultative) suit le circuit normal.

Les previews Vercel des PR n'ont pas la connexion Discord (adresse variable, redirect URI exacte
exigée) : tester l'auth en local.

## Environnement

- Windows. Le projet doit rester sur un disque local : les partages réseau (Z:) refusent les liens
  symboliques dont pnpm a besoin.
