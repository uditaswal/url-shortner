import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";
import prettier from "eslint-config-prettier";

export default defineConfig([
  js.configs.recommended,

  {
    files: ["**/*.{js,mjs,cjs}"],

    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",

      globals: {
        ...globals.node
      }
    },

    rules: {
      "no-unused-vars": "warn",
      "no-console": "off",

      semi: ["error", "always"],

      quotes: ["error", "double"],

      indent: ["error", 4]
    }
  },

  prettier
]);
