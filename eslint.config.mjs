// cspell:ignore innerhtml proptypes textnodes
import { defineConfig, globalIgnores } from "eslint/config";
import eslintReact from "@eslint-react/eslint-plugin";
import next from "@next/eslint-plugin-next";
import importX from "eslint-plugin-import-x";
import jsxA11y from "eslint-plugin-jsx-a11y-x";
import noSecrets from "eslint-plugin-no-secrets";
import reactHooks from "eslint-plugin-react-hooks";
import security from "eslint-plugin-security";
import globals from "globals";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-expressions": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
  reactHooks.configs.flat.recommended,
  next.configs["core-web-vitals"],
  security.configs.recommended,
  {
    files: ["**/*.{js,jsx,mjs,cjs,mts,cts,ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "@eslint-react": eslintReact,
      "import-x": importX,
      "jsx-a11y-x": jsxA11y,
      "no-secrets": noSecrets,
    },
    rules: {
      "@eslint-react/dom-no-dangerously-set-innerhtml-with-children": "error",
      "@eslint-react/dom-no-find-dom-node": "error",
      "@eslint-react/dom-no-render-return-value": "error",
      "@eslint-react/jsx-no-children-prop": "error",
      "@eslint-react/jsx-no-comment-textnodes": "error",
      "@eslint-react/no-component-will-mount": "error",
      "@eslint-react/no-component-will-receive-props": "error",
      "@eslint-react/no-component-will-update": "error",
      "@eslint-react/no-direct-mutation-state": "error",
      "@eslint-react/no-missing-component-display-name": "error",
      "@eslint-react/no-missing-key": "error",
      "@eslint-react/no-unsafe-component-will-mount": "error",
      "@eslint-react/no-unsafe-component-will-receive-props": "error",
      "@eslint-react/no-unsafe-component-will-update": "error",
      "import-x/no-anonymous-default-export": "warn",
      "jsx-a11y-x/alt-text": [
        "warn",
        {
          elements: ["img"],
          img: ["Image"],
        },
      ],
      "jsx-a11y-x/aria-props": "warn",
      "jsx-a11y-x/aria-proptypes": "warn",
      "jsx-a11y-x/aria-unsupported-elements": "warn",
      "jsx-a11y-x/role-has-required-aria-props": "warn",
      "jsx-a11y-x/role-supports-aria-props": "warn",
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
  {
    // Preserve existing runtime behavior while retaining the full Hooks preset
    // for all new and unaffected code after the ESLint 10 migration.
    files: [
      "app/components/ExchangeTimeZoneSelect.tsx",
      "app/create-group/page.tsx",
      "app/dashboard/page.tsx",
      "app/group/\\[id\\]/reveal/page.tsx",
      "app/secret-santa/use-shopping-lazada-state.ts",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["app/create-account/page.tsx"],
    rules: {
      "react-hooks/immutability": "off",
    },
  },
  {
    files: ["app/group/\\[id\\]/page.tsx"],
    rules: {
      "react-hooks/purity": "off",
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
