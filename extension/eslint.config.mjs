import typescriptEslint from "@typescript-eslint/eslint-plugin"
import tsParser from "@typescript-eslint/parser"

export default [
	{
		ignores: ["**/out", "**/dist", "**/*.d.ts"],
		files: ["src/**/*.ts", "src/**/*.tsx"],
	},
	{
		plugins: {
			"@typescript-eslint": typescriptEslint,
		},

		languageOptions: {
			parser: tsParser,
			ecmaVersion: 6,
			sourceType: "module",
		},

		rules: {
			"@typescript-eslint/naming-convention": [
				"warn",
				{
					selector: "import",
					format: ["camelCase", "PascalCase"],
				},
			],

			"@typescript-eslint/no-unsafe-argument": "off",
			"typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/semi": "off",
			curly: "warn",
			eqeqeq: "warn",
			"no-throw-literal": "warn",
			semi: "off",
			"react-hooks/exhaustive-deps": "off",
		},
	},
]
