import * as defaultThemes from "react-syntax-highlighter/dist/esm/styles/prism"
import * as generatedThemes from "./vscode-themes"

/*
VSCode extension webviews have a notoriously difficult time syntax highlighting with styles from the user's theme. We don’t have access to css variables like --vscode-function-color that map to all the token styles react-syntax-highlighter expects. Fortunately, react-syntax-highlighter comes with many built-in themes that we can map to popular VSCode themes. We can also use the few editor css variables exposed to us like --vscode-editor-background (see CodeBlock.tsx), which 99% of the time results in syntax highlighting identical to how the user's editor looks. This approach avoids the overhead of using VSCode's Monaco editor and the monaco-vscode-textmate-theme-converter as some other extensions do, and allows us to take advantage of all the benefits of react-syntax-highlighter.
For themes that don't have a 1:1 match with react-syntax-highlighter built-in themes, we can use Claude to generate style objects based on the results from the "Developer: Generate Color Theme From Current Settings" command.

https://github.com/microsoft/vscode/issues/56356
*/

// Available styles: https://github.com/react-syntax-highlighter/react-syntax-highlighter/blob/master/AVAILABLE_STYLES_PRISM.MD
const defaultSyntaxHighlighterThemes: { [key: string]: string } = {
	// VSCode built-in
	"Default Dark Modern": "vscDarkPlus",
	"Dark+": "vscDarkPlus",
	"Default Dark+": "vscDarkPlus",
	"Dark (Visual Studio)": "vscDarkPlus",
	"Visual Studio Dark": "vscDarkPlus",
	"Dark High Contrast": "vscDarkPlus",
	"Default High Contrast": "vscDarkPlus",
	"Light High Contrast": "vs",
	"Default High Contrast Light": "vs", // FIXME: some text renders white
	"Default Light Modern": "vs",
	"Light+": "vs",
	"Default Light+": "vs",
	"Light (Visual Studio)": "vs",
	"Visual Studio Light": "vs",

	// Third party
	Anysphere: "nightOwl",
	Abyss: "materialOceanic",
	"Kimbie Dark": "cb",
	Monokai: "darcula",
	"Monokai Dimmed": "darcula",
	"Solarized Dark": "solarizedDarkAtom",
	"Solarized Light": "solarizedlight",
	"Quiet Light": "solarizedlight",
	"Tomorrow Night Blue": "lucario",
	Dracula: "dracula",
	"Dracula Theme": "dracula",
	"Dracula Theme Soft": "dracula",
	"Night Owl": "nightOwl",
	"Material Theme": "materialDark",
	"Material Theme Lighter": "materialLight",
	"Material Theme Lighter High Contrast": "materialLight",
	"One Dark Pro": "oneDark",
	"One Dark Pro Darker": "oneDark",
	"One Dark Pro Flat": "oneDark",
	"One Dark Pro Mix": "oneDark",
	"One Light": "oneLight",
	"Winter is Coming": "nord",
	"Atom One Dark": "oneDark",
	"SynthWave '84": "synthwave84",
}

// Themes generated with Claude using "Developer: Generate Color Theme From Current Settings"
const generatedSyntaxHighlighterThemes: { [key: string]: string } = {
	"Github Dark": "githubDark",
	"GitHub Dark Colorblind (Beta)": "githubDark",
	"GitHub Dark Colorblind": "githubDark",
	"GitHub Dark Default": "githubDark",
	"GitHub Dark Dimmed": "githubDark",
	"GitHub Dark High Contrast": "githubDark",

	"Github Light": "githubLight",
	"GitHub Light Colorblind (Beta)": "githubLight",
	"GitHub Light Colorblind": "githubLight",
	"GitHub Light Default": "githubLight",
	"GitHub Light High Contrast": "githubLight",
}

export type SyntaxHighlighterStyle = { [key: string]: React.CSSProperties }

// Cache variables
let cachedTheme: SyntaxHighlighterStyle | null = null
let lastThemeName: string | null = null
let lastColors: { background: string; foreground: string } | null = null

// Determines if the theme is light or dark based on background color luminance
function isLightTheme(backgroundColor: string): boolean {
	const rgb = backgroundColor.match(/\d+/g)
	if (!rgb) return false
	const [r, g, b] = rgb.map(Number)
	const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
	return luminance > 0.5
}

// Retrieves VSCode theme colors from CSS variables
function getVSCodeThemeColors(): { background: string; foreground: string } | null {
	const style = getComputedStyle(document.documentElement)
	const background = style.getPropertyValue("--vscode-editor-background").trim()
	const foreground = style.getPropertyValue("--vscode-editor-foreground").trim()
	return background && foreground ? { background, foreground } : null
}

// Expanded fallback colors for syntax tokens in light and dark themes
const tokenFallbacks: { [key: string]: { light: string; dark: string } } = {
	keyword: { light: "#0000FF", dark: "#569CD6" }, // e.g., 'if', 'function'
	"class-name": { light: "#2B91AF", dark: "#4EC9B0" }, // e.g., class names like 'String'
	operator: { light: "#000000", dark: "#D4D4D4" }, // e.g., '+', '-', '==='
	string: { light: "#A31515", dark: "#CE9178" }, // e.g., "hello", 'world'
	comment: { light: "#008000", dark: "#6A9955" }, // e.g., // comments or /* block comments */
	number: { light: "#09885A", dark: "#B5CEA8" }, // e.g., 42, 3.14
	variable: { light: "#001080", dark: "#9CDCFE" }, // e.g., variable names
	function: { light: "#795E26", dark: "#DCDCAA" }, // e.g., function names
	punctuation: { light: "#000000", dark: "#D4D4D4" }, // e.g., '.', ',', ';'
	property: { light: "#001080", dark: "#9CDCFE" }, // e.g., object properties
	// Add more as needed for your specific use case
}

// Gets token color based on light/dark theme
function getTokenColor(token: string, isLight: boolean): string {
	const fallback = tokenFallbacks[token]
	return fallback ? fallback[isLight ? "light" : "dark"] : isLight ? "#000000" : "#D4D4D4"
}

// Creates a dynamic Prism theme based on VSCode colors
function createDynamicPrismTheme(): SyntaxHighlighterStyle {
	const colors = getVSCodeThemeColors()
	if (!colors) {
		return defaultThemes.vscDarkPlus // Default fallback
	}

	const isLight = isLightTheme(colors.background)

	return {
		'code[class*="language-"]': {
			color: colors.foreground,
			background: colors.background,
		},
		'pre[class*="language-"]': {
			background: colors.background,
		},
		keyword: { color: getTokenColor("keyword", isLight) },
		"class-name": { color: getTokenColor("class-name", isLight) },
		operator: { color: getTokenColor("operator", isLight) },
		string: { color: getTokenColor("string", isLight) },
		comment: { color: getTokenColor("comment", isLight) },
		number: { color: getTokenColor("number", isLight) },
		variable: { color: getTokenColor("variable", isLight) },
		function: { color: getTokenColor("function", isLight) },
		punctuation: { color: getTokenColor("punctuation", isLight) },
		property: { color: getTokenColor("property", isLight) },
		// Add more token styles as needed
	}
}

// Helper function to compare objects
function deepEqual(obj1: any, obj2: any): boolean {
	return JSON.stringify(obj1) === JSON.stringify(obj2)
}

export function getSyntaxHighlighterStyleFromTheme(themeName: string): SyntaxHighlighterStyle | undefined {
	const colors = getVSCodeThemeColors()

	if (colors) {
		// Check if the theme name or colors have changed
		if (themeName !== lastThemeName || !deepEqual(colors, lastColors)) {
			cachedTheme = createDynamicPrismTheme()
			lastThemeName = themeName
			lastColors = colors
		}
		return cachedTheme ?? defaultThemes.vscDarkPlus
	}

	// Fallback to static themes if not in VSCode (colors is null)
	const defaultSyntaxHighlighterTheme = Object.entries(defaultSyntaxHighlighterThemes).find(([key]) =>
		key.toLowerCase().startsWith(themeName.toLowerCase())
	)?.[1]
	if (defaultSyntaxHighlighterTheme && defaultSyntaxHighlighterTheme in defaultThemes) {
		return defaultThemes[defaultSyntaxHighlighterTheme as keyof typeof defaultThemes]
	}

	const generatedSyntaxHighlighterTheme = Object.entries(generatedSyntaxHighlighterThemes).find(([key]) =>
		key.toLowerCase().startsWith(themeName.toLowerCase())
	)?.[1]
	if (generatedSyntaxHighlighterTheme && generatedSyntaxHighlighterTheme in generatedThemes) {
		return generatedThemes[generatedSyntaxHighlighterTheme as keyof typeof generatedThemes]
	}

	// Final fallback to a default theme
	return defaultThemes.vscDarkPlus
}
