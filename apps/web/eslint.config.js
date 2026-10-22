import base from "@app/config/eslint/base";
import nextVitals from "eslint-config-next/core-web-vitals";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  ...nextVitals,
  ...base,
  {
    rules: {
      // Les apostrophes du français sont légitimes dans le JSX.
      "react/no-unescaped-entities": ["error", { forbid: [">", "}"] }],
    },
  },
  globalIgnores([".next/**", "out/**", "next-env.d.ts"]),
]);
