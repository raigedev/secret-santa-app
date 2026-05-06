import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import noSecrets from "eslint-plugin-no-secrets";
import security from "eslint-plugin-security";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  security.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    plugins: {
      "no-secrets": noSecrets,
    },
    rules: {
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-script-url": "error",
      "security/detect-object-injection": "off",
      "no-secrets/no-secrets": [
        "error",
        {
          ignoreContent: "(NEXT_PUBLIC_|process\\.env\\.|https://fonts\\.googleapis\\.com|https://c\\.lazada\\.com\\.ph/)",
          ignoreIdentifiers: [
            "LAZADA_DEFAULT_API_BASE_URL",
            "LAZADA_API_BASE_URL",
            "NEXT_PUBLIC_SUPABASE_URL",
            "NEXT_PUBLIC_SUPABASE_ANON_KEY",
          ],
          tolerance: 4.2,
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".agent/**",
    ".agents/**",
    ".codex/**",
    ".vercel/**",
    "out/**",
    "build/**",
    "coverage/**",
    "graphify-out/**",
    "lib/affiliate/lazada-feed-data.generated.json",
    "next-env.d.ts",
    "node_modules/**",
    "output/**",
    "playwright-report/**",
    "supabase/.branches/**",
    "supabase/.temp/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
