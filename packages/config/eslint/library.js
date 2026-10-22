import base from "./base.js";

/**
 * Config des packages/* et games/* : ils doivent rester utilisables hors de Next
 * (futur serveur temps réel dans apps/), donc aucun import de Next.
 */
export default [
  ...base,
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "next", message: "Pas d'import Next dans packages/* et games/*." }],
          patterns: [
            {
              group: ["next/*", "@next/*"],
              message: "Pas d'import Next dans packages/* et games/*.",
            },
          ],
        },
      ],
    },
  },
];
