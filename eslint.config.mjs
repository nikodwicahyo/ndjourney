import nextVitals from "eslint-config-next/core-web-vitals";

/** @type {import("eslint").Linter.Config[]} */
const config = [
  ...nextVitals,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "coverage/**",
      "lib/generated/**",
      "public/version.json",
      "package-lock.json",
    ],
  },
];

export default config;
