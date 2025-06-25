import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Global ignores should be first and separate
  {
    ignores: [
      "**/cdk/**",
      "cdk/**",
      "cdk.out/**",
      "scripts/**",
      ".next/**",
      "out/**",
      "dist/**",
      "build/**",
      "node_modules/**",
      "*.generated.ts",
      "*.d.ts"
    ]
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react/display-name": "off"
    }
  }
];

export default eslintConfig;