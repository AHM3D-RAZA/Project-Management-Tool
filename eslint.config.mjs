import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  { ignores: ["next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // useMemoFirebase (src/firebase/provider.tsx) is a thin wrapper
      // around useMemo used across the codebase for Firebase queries/refs.
      // Without this, exhaustive-deps only checks the real useMemo/useEffect/
      // useCallback and silently skips every useMemoFirebase call site.
      "react-hooks/exhaustive-deps": ["warn", { additionalHooks: "(useMemoFirebase)" }],
    },
  },
];

export default eslintConfig;
