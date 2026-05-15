import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import boundaries from "eslint-plugin-boundaries";
import globals from "globals";

/** FSD: each feature slice is isolated — no imports from sibling features. */
const FEATURE_SLICES = [
  "ai-booking-chat",
  "auth-session-redirect",
  "create-post",
  "create-story",
  "email-verification-otp",
  "message-attachments",
  "message-link-preview",
  "post-share",
  "subscription-paywall-redirect",
];

const featureElements = FEATURE_SLICES.map((name) => ({
  type: `feature-${name}`,
  pattern: `src/features/${name}/**/*`,
}));

const toAllFeatures = FEATURE_SLICES.map((name) => ({ to: { type: `feature-${name}` } }));

const featureSelfOnlyRules = FEATURE_SLICES.map((name) => ({
  from: { type: `feature-${name}` },
  allow: [
    { to: { type: "shared" } },
    { to: { type: "entities" } },
    { to: { type: "app" } },
    { to: { type: `feature-${name}` } },
  ],
}));

const boundariesElements = [
  { type: "app", pattern: "src/app/**/*" },
  { type: "pages", pattern: "src/pages/**/*" },
  { type: "widgets", pattern: "src/widgets/**/*" },
  { type: "entities", pattern: "src/entities/**/*" },
  { type: "shared", pattern: "src/shared/**/*" },
  ...featureElements,
];

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
      "boundaries/elements": boundariesElements,
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "allow",
          rules: [
            {
              from: { type: "shared" },
              allow: [{ to: { type: "shared" } }, { to: { type: "app" } }],
            },
            {
              from: { type: "entities" },
              allow: [{ to: { type: "shared" } }, { to: { type: "entities" } }, { to: { type: "app" } }],
            },
            ...featureSelfOnlyRules,
            {
              from: { type: "widgets" },
              allow: [
                { to: { type: "shared" } },
                { to: { type: "entities" } },
                ...toAllFeatures,
                { to: { type: "widgets" } },
                { to: { type: "app" } },
              ],
            },
            {
              from: { type: "pages" },
              allow: [
                { to: { type: "shared" } },
                { to: { type: "entities" } },
                ...toAllFeatures,
                { to: { type: "widgets" } },
                { to: { type: "pages" } },
                { to: { type: "app" } },
              ],
            },
            {
              from: { type: "app" },
              allow: [
                { to: { type: "shared" } },
                { to: { type: "entities" } },
                ...toAllFeatures,
                { to: { type: "widgets" } },
                { to: { type: "pages" } },
                { to: { type: "app" } },
              ],
            },
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
