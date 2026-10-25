import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "./generated/prisma/client";

export { Prisma } from "./generated/prisma/client";

export type Db = PrismaClient;
/** Client utilisable à l'intérieur d'une transaction (`$transaction(async (tx) => …)`). */
export type DbTx = Prisma.TransactionClient;

export function createDb(url: string): Db {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

// Un seul client par process, conservé sur globalThis pour survivre au rechargement à chaud de Next.
const globalForDb = globalThis as unknown as { __appDb?: Db };

function getDb(): Db {
  if (!globalForDb.__appDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL n'est pas définie.");
    globalForDb.__appDb = createDb(url);
  }
  return globalForDb.__appDb;
}

/**
 * Client partagé, créé au premier usage : importer `@app/db` ne lit pas l'env
 * (utile au build Next, où DATABASE_URL peut manquer).
 */
export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    const client = getDb();
    const value: unknown = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

/**
 * Exécute `fn` dans une transaction. Si `opts.tx` est fourni, `fn` s'exécute dans cette
 * transaction existante au lieu d'en ouvrir une nouvelle : c'est ce qui permet aux fonctions
 * d'écriture (`fn(input, opts?: { tx?: DbTx })`) de se composer entre modules.
 * `timeout` (ms) remplace la limite par défaut de Prisma (5 s) pour la transaction ouverte ici ;
 * il est sans effet dans une transaction existante, dont la limite est fixée par son ouvreur.
 */
export function withTx<T>(
  fn: (tx: DbTx) => Promise<T>,
  opts?: { tx?: DbTx; timeout?: number },
): Promise<T> {
  if (opts?.tx) return fn(opts.tx);
  return db.$transaction(fn, opts?.timeout === undefined ? undefined : { timeout: opts.timeout });
}
