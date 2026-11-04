// @ts-check
const eslint = require("@eslint/js");
const { defineConfig } = require("eslint/config");
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");

module.exports = defineConfig([
  {
    files: ["**/*.ts"],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      "@angular-eslint/directive-selector": ["error", { type: "attribute", prefix: "app", style: "camelCase" }],
      "@angular-eslint/component-selector": ["error", { type: "element", prefix: "app", style: "kebab-case" }],
      "@angular-eslint/prefer-on-push-component-change-detection": "error",
      "no-console": ["warn", { allow: ["error"] }],
      // Cho phép callback rỗng mặc định của ControlValueAccessor: onChange = () => {}
      "@typescript-eslint/no-empty-function": ["error", { allow: ["arrowFunctions"] }],
      // Tạm ở mức warn: code cũ sẽ được viết lại ở các giai đoạn sau, khi đó nâng lên error
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "@angular-eslint/no-output-native": "warn",
    },
  },
  {
    files: ["**/*.html"],
    extends: [
      angular.configs.templateRecommended,
      angular.configs.templateAccessibility,
    ],
    rules: {
      // Tạm ở mức warn: được sửa ở giai đoạn accessibility
      "@angular-eslint/template/click-events-have-key-events": "warn",
      "@angular-eslint/template/interactive-supports-focus": "warn",
      "@angular-eslint/template/label-has-associated-control": "warn",
    },
  },
]);
