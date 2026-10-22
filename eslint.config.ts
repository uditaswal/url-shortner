import js from "@eslint/js";
import globals from "globals";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config(
    { ignores: ["dist/**", "node_modules/**"] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["**/*.ts"],
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.browser
            }
        },
        rules: {
            "no-console": "off",
            "@typescript-eslint/no-unused-vars": "warn",
            semi: ["error", "always"],
            quotes: ["error", "double"],
            indent: ["error", 4]
        }
    },
    prettier
);
