import { describe, expect, it } from "vitest";
import {
  BASE_CATEGORIES,
  initialRounds,
  normalizeCategoryName,
  predictionOpen,
  rankScores,
  shuffle,
  votesNeeded,
  youtubeId,
  type Phase,
  type RoundStatus,
} from "../src/rules";

describe("Règles GOTY sans base", () => {
  it("prépare les cinq places et neuf prix, avec des noms et positions uniques", () => {
    const rounds = initialRounds();
    expect(rounds).toHaveLength(14);
    expect(rounds.slice(0, 5).map((r) => r.rank)).toEqual([5, 4, 3, 2, 1]);
    expect(rounds.slice(5).map((r) => r.name)).toEqual(BASE_CATEGORIES);
    expect(rounds.map((r) => r.position)).toEqual(Array.from({ length: 14 }, (_, i) => i));
    expect(new Set(rounds.map((r) => r.normalizedName)).size).toBe(14);
    expect(rounds.filter((r) => r.soundtrack).map((r) => r.name)).toEqual(["Meilleure bande-son"]);
    expect(normalizeCategoryName("  D’ÀUTRES   Idées ")).toBe("d'autres idees");
  });

  it.each([
    [1, 1],
    [4, 3],
    [5, 4],
    [6, 5],
    [8, 6],
  ])("exige 75 %% des %i participants", (count, needed) => {
    expect(votesNeeded(count)).toBe(needed);
  });
  it.each([0, -1, 2.5, NaN, Infinity])("refuse un effectif invalide : %s", (count) => {
    expect(() => votesNeeded(count)).toThrow(RangeError);
  });

  for (const phase of ["categories", "preparation", "live", "closed"] satisfies Phase[]) {
    it(`ouvre uniquement les pronostics des rubriques éligibles en phase ${phase}`, () => {
      for (const status of [
        "draft",
        "announced",
        "locked",
        "revealing",
        "done",
      ] satisfies RoundStatus[]) {
        expect(predictionOpen(status, phase)).toBe(
          ["preparation", "live"].includes(phase) && ["draft", "announced"].includes(status),
        );
      }
    });
  }

  it("classe les ex æquo sans départage et sans modifier les entrées", () => {
    const entries = [
      { id: "a", points: 0 },
      { id: "b", points: 3 },
      { id: "c", points: 3 },
    ];
    expect(rankScores(entries)).toEqual([
      { id: "b", points: 3, rank: 1 },
      { id: "c", points: 3, rank: 1 },
      { id: "a", points: 0, rank: 3 },
    ]);
    expect(entries[0]?.id).toBe("a");
    expect(rankScores([])).toEqual([]);
    expect(rankScores([{ points: 0 }, { points: 0 }]).map((r) => r.rank)).toEqual([1, 1]);
  });

  it("tire une permutation sans modifier les identifiants ou la source", () => {
    const values = Object.freeze(["a", "b", "c", "d"]);
    for (let i = 0; i < 10; i++) expect(shuffle(values).sort()).toEqual(values);
    expect(shuffle([])).toEqual([]);
    expect(shuffle(["a"])).toEqual(["a"]);
  });

  it.each([
    "https://youtu.be/abcdefghijk?t=12",
    "https://www.youtube.com/watch?v=abcdefghijk&list=example",
    "https://m.youtube.com/watch?v=abcdefghijk",
    "https://youtube.com/embed/abcdefghijk",
    "https://youtube.com/shorts/abcdefghijk",
  ])("reconnaît un lien YouTube : %s", (url) => expect(youtubeId(url)).toBe("abcdefghijk"));

  it.each([
    "http://youtu.be/abcdefghijk",
    "https://youtube.com.example.test/watch?v=abcdefghijk",
    "https://example.test/abcdefghijk",
    "https://youtu.be/trop-court",
    "https://youtube.com/embed/abcdefghijk/suite",
    "javascript:alert(1)",
    "pas une URL",
    "https://user:password@youtube.com/watch?v=abcdefghijk",
    "https://youtu.be:123/abcdefghijk",
  ])("refuse un lien non conforme : %s", (url) => expect(youtubeId(url)).toBeNull());
});
