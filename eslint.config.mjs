import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The extension and the native host are run by the browser and by node as
    // plain CommonJS scripts, not bundled by Next. They intentionally have no
    // ESM imports, which the no-require-imports rule would flag.
    "native/**",
    "extension/**",
  ]),
]);

export default eslintConfig;
