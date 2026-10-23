import { ForbiddenError } from "@app/core";
import { db } from "@app/db";
import { truncateTestDb } from "@app/db/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { DESIGNS, listDesignVotes, rateDesign } from "../src/index";

const ADMIN = { id: "user-admin", discordId: "100000000000000001" };
const MEMBER = { id: "user-member", discordId: "100000000000000002" };

beforeEach(async () => {
  await truncateTestDb();
});

describe("rateDesign", () => {
  it("refuse un membre non admin", async () => {
    await expect(rateDesign(MEMBER, { designId: "pixel", stars: 4 })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(await db.tcgDesignVote.count()).toBe(0);
  });

  it("enregistre puis remplace la note de l'admin (une seule par design)", async () => {
    await rateDesign(ADMIN, { designId: "pixel", stars: 3, comment: "  Pas mal  " });
    const vote = await rateDesign(ADMIN, { designId: "pixel", stars: "5", comment: "" });
    expect(vote).toMatchObject({ designId: "pixel", userId: ADMIN.id, stars: 5, comment: null });
    expect(await db.tcgDesignVote.count()).toBe(1);
  });

  it("garde le commentaire nettoyé", async () => {
    const vote = await rateDesign(ADMIN, {
      designId: "comics",
      stars: 2,
      comment: "  Trop chargé ",
    });
    expect(vote.comment).toBe("Trop chargé");
  });

  it("refuse une note hors de 1 à 5 et un design inconnu", async () => {
    await expect(rateDesign(ADMIN, { designId: "pixel", stars: 0 })).rejects.toBeInstanceOf(
      ZodError,
    );
    await expect(rateDesign(ADMIN, { designId: "pixel", stars: 6 })).rejects.toBeInstanceOf(
      ZodError,
    );
    await expect(rateDesign(ADMIN, { designId: "pixel", stars: 2.5 })).rejects.toBeInstanceOf(
      ZodError,
    );
    await expect(rateDesign(ADMIN, { designId: "inconnu", stars: 3 })).rejects.toBeInstanceOf(
      ZodError,
    );
  });
});

describe("listDesignVotes", () => {
  it("refuse un membre non admin", async () => {
    await expect(listDesignVotes(MEMBER)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("renvoie les notes de tous les admins", async () => {
    const other = { id: "user-admin-2", discordId: "100000000000000001" };
    await rateDesign(ADMIN, { designId: "pixel", stars: 4 });
    await rateDesign(other, { designId: "pixel", stars: 2, comment: "Bof" });
    const votes = await listDesignVotes(ADMIN);
    expect(votes).toHaveLength(2);
    expect(votes.map((v) => v.userId).sort()).toEqual([ADMIN.id, other.id]);
  });
});

describe("DESIGNS", () => {
  it("a des identifiants uniques", () => {
    const ids = DESIGNS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
