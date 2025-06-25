import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "cdk/**/*", 
      "cdk.out/**/*",
      "cdk/lambda/**/*.js",
      "cdk/lambda-layers/**/*.js",
      "scripts/**/*.js",
      ".next/**/*",
      "out/**/*",
      "dist/**/*",
      "build/**/*",
      "node_modules/**/*",
      "*.generated.ts",
      "*.d.ts"
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react/display-name": "off"
    }
  }
];

export default eslintConfig;