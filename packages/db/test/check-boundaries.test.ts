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

  it("interdit tout import de @app/db dans une app", () => {
    expect(check("apps/web/lib/x.ts", 'import { db } from "@app/db";')).toHaveLength(1);
  });
});
