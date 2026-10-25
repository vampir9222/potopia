import { db } from "@app/db";
import { truncateTestDb } from "@app/db/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import {
  commentTags,
  DESIGN_TAB,
  designNumber,
  DESIGNS,
  EFFECTS_TAB,
  listDesignVotes,
  rateDesign,
  REFERENCES,
} from "../src/index";

const ADMIN = { id: "user-admin" };
const MEMBER = { id: "user-member" };

beforeEach(async () => {
  await truncateTestDb();
});

describe("rateDesign", () => {
  it("ouvert à tous les membres", async () => {
    const vote = await rateDesign(MEMBER, { designId: "mix-verre", stars: 4 });
    expect(vote).toMatchObject({ designId: "mix-verre", userId: MEMBER.id, stars: 4 });
  });

  it("enregistre puis remplace la note du membre (une seule par design)", async () => {
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

  it("accepte 0 étoile : commentaire sans note, ou note retirée", async () => {
    const vote = await rateDesign(ADMIN, { designId: "pixel", stars: 0, comment: "À revoir" });
    expect(vote).toMatchObject({ stars: 0, comment: "À revoir" });
  });

  it("refuse une note hors de 0 à 5 et un design inconnu", async () => {
    await expect(rateDesign(ADMIN, { designId: "pixel", stars: -1 })).rejects.toBeInstanceOf(
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
  it("renvoie les notes de tous les membres", async () => {
    await rateDesign(ADMIN, { designId: "pixel", stars: 4 });
    await rateDesign(MEMBER, { designId: "pixel", stars: 2, comment: "Bof" });
    const votes = await listDesignVotes();
    expect(votes).toHaveLength(2);
    expect(votes.map((v) => v.userId).sort()).toEqual([ADMIN.id, MEMBER.id]);
  });
});

describe("DESIGNS", () => {
  it("a des identifiants uniques", () => {
    const ids = DESIGNS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("garde les numéros affichés : 39 et 44 sont les deux références", () => {
    expect(REFERENCES.map(designNumber)).toEqual([39, 44]);
    expect([...DESIGN_TAB, ...EFFECTS_TAB].every((id) => designNumber(id) > 47)).toBe(true);
  });
});

describe("commentTags", () => {
  it("lit « à supprimer » et « variant », accents et majuscules ignorés", () => {
    expect(commentTags("À SUPPRIMER")).toEqual({ remove: true, variant: false });
    expect(commentTags("a supprimer, trop chargé")).toEqual({ remove: true, variant: false });
    expect(commentTags("Variant sympa pour plus tard")).toEqual({ remove: false, variant: true });
    expect(commentTags("en variante, oui")).toEqual({ remove: false, variant: true });
    expect(commentTags("rien à signaler")).toEqual({ remove: false, variant: false });
    expect(commentTags(null)).toEqual({ remove: false, variant: false });
  });
});
