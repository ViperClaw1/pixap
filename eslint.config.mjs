import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import boundaries from "eslint-plugin-boundaries";
import globals from "globals";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["**/node_modules/**", "supabase/**", "backend/**", ".expo/**"],
  },
  {
    files: ["src/**/*.{ts,tsx}", "App.tsx"],
    languageOptions: {
      globals: {
        ...globals.es2021,
        __DEV__: "readonly",
      },
    },
    plugins: {
      boundaries,
    },
    settings: {
      "boundaries/dependency-nodes": ["import"],
      "boundaries/elements": [
        { type: "app", pattern: "src/app/**/*" },
        { type: "pages", pattern: "src/pages/**/*" },
        { type: "widgets", pattern: "src/widgets/**/*" },
        { type: "features", pattern: "src/features/**/*" },
        { type: "entities", pattern: "src/entities/**/*" },
        { type: "shared", pattern: "src/shared/**/*" },
        { type: "infra", pattern: "src/{navigation,contexts,services,types}/**/*" },
        { type: "legacy", pattern: "src/{components,lib}/**/*" },
      ],
    },
    rules: {
      "boundaries/element-types": [
        "error",
        {
          default: "allow",
          rules: [
            { from: "shared", allow: ["shared", "infra"] },
            { from: "entities", allow: ["shared", "entities", "infra"] },
            { from: "features", allow: ["shared", "entities", "features", "infra", "legacy"] },
            { from: "widgets", allow: ["shared", "entities", "features", "widgets", "infra"] },
            { from: "pages", allow: ["shared", "entities", "features", "widgets", "pages", "infra", "legacy"] },
            { from: "app", allow: ["shared", "entities", "features", "widgets", "pages", "app", "infra", "legacy"] },
            { from: "infra", allow: ["shared", "entities", "features", "widgets", "pages", "infra", "legacy", "app"] },
            { from: "legacy", allow: ["shared", "entities", "features", "widgets", "pages", "infra", "legacy", "app"] },
          ],
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "prefer-const": "warn",
    },
  },
);
