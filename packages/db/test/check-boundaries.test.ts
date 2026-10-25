import { describe, expect, it } from "vitest";
import { findViolations, parseSchema, type Domain } from "../scripts/check-boundaries";

const core: Domain = {
  dir: "packages/core",
  ...parseSchema(`model User {\n  id String @id\n  @@schema("core")\n}\nmodel ActivityEvent {\n}`),
};
const economy: Domain = {
  dir: "packages/economy",
  ...parseSchema(`model Wallet {\n  @@schema("economy")\n}`),
};
const domains = [core, economy];

const check = (path: string, content: string) => findViolations(domains, [{ path, content }]);

describe("check:boundaries", () => {
  it("lit les modèles et schémas d'un schema.prisma", () => {
    expect([...core.delegates]).toEqual(["user", "activityEvent"]);
    expect([...core.schemas]).toEqual(["core"]);
  });

  it("accepte l'accès d'un module à ses propres modèles", () => {
    expect(
      check("packages/core/src/users.ts", "db.user.findMany(); tx.activityEvent.create()"),
    ).toEqual([]);
    expect(
      check("packages/economy/src/ledger.ts", 'tx.$queryRaw`SELECT * FROM "economy"."wallets"`'),
    ).toEqual([]);
  });

  it("signale un modèle d'un autre module, avec la ligne", () => {
    const v = check("packages/economy/src/x.ts", "const a = 1;\nawait db.user.findMany();");
    expect(v).toEqual([
      {
        path: "packages/economy/src/x.ts",
        line: 2,
        message: "modèle « user » du module packages/core",
      },
    ]);
  });

  it("reconnaît un accès via une expression : (opts?.tx ?? db).modèle.méthode()", () => {
    expect(
      check("packages/economy/src/x.ts", "(opts?.tx ?? db).activityEvent.create({})"),
    ).toHaveLength(1);
  });

  it("signale du SQL brut visant le schéma d'un autre module", () => {
    expect(
      check("packages/economy/src/x.ts", 'db.$executeRaw`DELETE FROM "core"."users"`'),
    ).toHaveLength(1);
  });

  it("signale du SQL brut dont le schéma n'est pas (ou pas entièrement) entre guillemets", () => {
    for (const sql of [
      "SELECT * FROM core.users",
      'SELECT * FROM "core".users',
      'SELECT * FROM core."users"',
      "DELETE FROM core.users",
      "INSERT INTO core.notifications (id) VALUES (1)",
      "UPDATE core.users SET name = 'x'",
      'SELECT * FROM "economy"."wallets" w JOIN core.users u ON u.id = w.user_id',
    ]) {
      expect(check("packages/economy/src/x.ts", `db.$queryRaw\`${sql}\``), sql).toHaveLength(1);
    }
    // Ses propres tables, et un identifiant quelconque devant un point, ne sont pas signalés.
    expect(
      check(
        "packages/economy/src/x.ts",
        'db.$queryRaw`SELECT w."balance" FROM economy.wallets w WHERE w."user_id" = ${id}`',
      ),
    ).toEqual([]);
    expect(check("packages/economy/src/x.ts", 'import { x } from "lodash.debounce";')).toEqual([]);
  });

  it("reconnaît n'importe quel nom de client et n'importe quelle méthode", () => {
    for (const code of [
      "t.user.updateManyAndReturn({})",
      "t.user.findRaw({})",
      "await this.client.user.count()",
      "(opts?.tx ?? db).user.aggregateRaw({})",
      "db\n  .user\n  .findMany()",
    ]) {
      expect(check("packages/economy/src/x.ts", code), code).toHaveLength(1);
    }
    // Un simple champ `user` d'un objet n'est pas un délégué.
    expect(check("packages/economy/src/x.ts", "session.user.id; member.user.name.trim()")).toEqual(
      [],
    );
  });

  it("signale un délégué d'un autre module pris par destructuration", () => {
    expect(check("packages/economy/src/x.ts", "const { user } = t;")).toHaveLength(1);
    expect(check("packages/economy/src/x.ts", "const { wallet, user: u } = tx;")).toEqual([
      {
        path: "packages/economy/src/x.ts",
        line: 1,
        message: "modèle « user » du module packages/core",
      },
    ]);
    expect(check("packages/core/src/x.ts", "const { user } = db;")).toEqual([]);
    // Le résultat d'un appel n'est pas un client.
    expect(check("packages/economy/src/x.ts", "const { user } = await getSession();")).toEqual([]);
  });

  it("signale les types Prisma des modèles d'un autre module", () => {
    for (const code of [
      "type W = Prisma.WalletWhereInput;",
      "type W = Prisma.WalletGetPayload<{ select: { balance: true } }>;",
      "const include = {} satisfies Prisma.WalletInclude;",
    ]) {
      const v = check("packages/core/src/x.ts", code);
      expect(v, code).toHaveLength(1);
      expect(v[0]?.message).toContain("packages/economy");
    }
    expect(check("packages/economy/src/x.ts", "type W = Prisma.WalletWhereInput;")).toEqual([]);
    // Types génériques de Prisma, dont ceux qui commencent comme le modèle « transaction ».
    expect(
      check(
        "packages/core/src/x.ts",
        "let a: Prisma.JsonValue; let b: Prisma.TransactionClient; let c: Prisma.TransactionIsolationLevel; Prisma.PrismaClientKnownRequestError;",
      ),
    ).toEqual([]);
  });

  it("interdit tout import de @app/db dans une app, dynamique ou de @app/db/testing compris", () => {
    for (const code of [
      'import { db } from "@app/db";',
      'import type { DbTx } from "@app/db";',
      'import { truncateTestDb } from "@app/db/testing";',
      'const { db } = await import("@app/db");',
      "const { db } = await import('@app/db');",
      'const { db } = require("@app/db");',
    ]) {
      expect(check("apps/web/lib/x.ts", code), code).toHaveLength(1);
    }
    expect(check("apps/web/lib/x.ts", 'const packages = ["@app/db", "@app/core"];')).toEqual([]);
  });
});
