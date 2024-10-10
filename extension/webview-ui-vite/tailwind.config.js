import plugin from "tailwindcss"

function parseColor(color) {
	if (color.startsWith("#")) {
		color = color.slice(1)
	}
	if (color.length === 3 || color.length === 4) {
		color = color
			.split("")
			.map((c) => c + c)
			.join("")
	}
	const alpha = color.length === 8 ? parseInt(color.slice(6, 8), 16) / 255 : 1
	return {
		hex: "#" + color.slice(0, 6),
		alpha,
	}
}

function applyOpacity(hex, alpha) {
	const parsedColor = parseColor(hex)
	const newAlpha = Math.round(parsedColor.alpha * alpha * 255)
		.toString(16)
		.padStart(2, "0")
	return parsedColor.hex + newAlpha
}

function createColorWithOpacity(variable) {
	return ({ opacityValue }) => {
		if (opacityValue === undefined) {
			return `var(${variable})`
		}
		const opacity = parseFloat(opacityValue)
		if (isNaN(opacity)) {
			return `var(${variable})`
		}
		return `color-mix(in srgb, var(${variable}), transparent ${100 - opacity * 100}%)`
	}
}

/** @type {import('tailwindcss').Config} */
export default {
	darkMode: ["class"],
	content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
	theme: {
		extend: {
			borderRadius: {
				lg: "var(--radius)",
				md: "calc(var(--radius) - 2px)",
				sm: "calc(var(--radius) - 4px)",
			},
			colors: {
				border: createColorWithOpacity("--vscode-widget-border"),
				input: createColorWithOpacity("--vscode-input-background"),
				ring: createColorWithOpacity("--vscode-focusBorder"),
				background: createColorWithOpacity("--vscode-diffEditor-unchangedRegionBackground"),
				foreground: createColorWithOpacity("--vscode-diffEditor-unchangedRegionForeground"),
				// background: createColorWithOpacity("--vscode-editor-background"),
				// foreground: createColorWithOpacity("--vscode-editor-foreground"),
				primary: {
					DEFAULT: createColorWithOpacity("--vscode-button-background"),
					foreground: createColorWithOpacity("--vscode-button-foreground"),
				},
				secondary: {
					DEFAULT: createColorWithOpacity("--vscode-button-secondaryBackground"),
					foreground: createColorWithOpacity("--vscode-button-secondaryForeground"),
				},
				destructive: {
					DEFAULT: createColorWithOpacity("--vscode-inputValidation-errorBackground"),
					foreground: createColorWithOpacity("--vscode-inputValidation-errorForeground"),
				},
				muted: {
					DEFAULT: createColorWithOpacity("--vscode-editor-inactiveSelectionBackground"),
					foreground: createColorWithOpacity("--vscode-disabledForeground"),
				},
				accent: {
					DEFAULT: createColorWithOpacity("--vscode-statusBar-background"),
					foreground: createColorWithOpacity("--vscode-statusBar-foreground"),
				},
				popover: {
					DEFAULT: createColorWithOpacity("--vscode-editorWidget-background"),
					foreground: createColorWithOpacity("--vscode-editorWidget-foreground"),
				},
				card: {
					// DEFAULT: createColorWithOpacity("--vscode-sideBar-background"),
					// foreground: createColorWithOpacity("--vscode-sideBar-foreground"),
					DEFAULT: createColorWithOpacity("--vscode-editor-background"),
					foreground: createColorWithOpacity("--vscode-editor-foreground"),
				},
				chart: {
					1: createColorWithOpacity("--vscode-charts-red"),
					2: createColorWithOpacity("--vscode-charts-blue"),
					3: createColorWithOpacity("--vscode-charts-yellow"),
					4: createColorWithOpacity("--vscode-charts-orange"),
					5: createColorWithOpacity("--vscode-charts-green"),
				},
				success: {
					DEFAULT: createColorWithOpacity("--vscode-terminal-ansiGreen"),
					foreground: createColorWithOpacity("--vscode-button-foreground"),
				},
				warning: {
					DEFAULT: createColorWithOpacity("--vscode-editorWarning-foreground"),
					foreground: createColorWithOpacity("--vscode-button-foreground"),
				},
				info: {
					DEFAULT: createColorWithOpacity("--vscode-editorInfo-foreground"),
					foreground: createColorWithOpacity("--vscode-button-foreground"),
				},
			},

			// colors: {
			// 	border: createColorWithOpacity("--vscode-widget-border"),
			// 	input: createColorWithOpacity("--vscode-input-background"),
			// 	ring: createColorWithOpacity("--vscode-focusBorder"),
			// 	background: createColorWithOpacity("--vscode-diffEditor-unchangedRegionBackground"),
			// 	foreground: createColorWithOpacity("--vscode-diffEditor-unchangedRegionForeground"),
			// 	primary: {
			// 		DEFAULT: createColorWithOpacity("--vscode-button-background"),
			// 		foreground: createColorWithOpacity("--vscode-button-foreground"),
			// 	},
			// 	success: {
			// 		DEFAULT: createColorWithOpacity("--vscode-terminal-ansiGreen"),
			// 		foreground: createColorWithOpacity("--vscode-button-foreground"),
			// 	},
			// 	secondary: {
			// 		DEFAULT: createColorWithOpacity("--vscode-button-secondaryBackground"),
			// 		foreground: createColorWithOpacity("--vscode-button-secondaryForeground"),
			// 	},
			// 	warning: {
			// 		DEFAULT: createColorWithOpacity("--vscode-editorWarning-foreground"),
			// 		foreground: createColorWithOpacity("--vscode-button-foreground"),
			// 	},
			// 	info: {
			// 		DEFAULT: createColorWithOpacity("--vscode-editorInfo-foreground"),
			// 		foreground: createColorWithOpacity("--vscode-button-foreground"),
			// 	},
			// 	destructive: {
			// 		DEFAULT: createColorWithOpacity("--vscode-editorError-foreground"),
			// 		foreground: createColorWithOpacity("--vscode-button-foreground"),
			// 	},
			// 	// muted: {
			// 	// 	DEFAULT: createColorWithOpacity("--vscode-editorWidget-background"),
			// 	// 	foreground: createColorWithOpacity("--vscode-editorWidget-foreground"),
			// 	// },
			// 	// accent: {
			// 	// 	DEFAULT: createColorWithOpacity("--vscode-editor-inactiveSelectionBackground"),
			// 	// 	foreground: createColorWithOpacity("--vscode-editor-foreground"),
			// 	// },
			// 	// popover: {
			// 	// 	DEFAULT: createColorWithOpacity("--vscode-editorWidget-background"),
			// 	// 	foreground: createColorWithOpacity("--vscode-editorWidget-foreground"),
			// 	// },
			// 	// card: {
			// 	// 	DEFAULT: createColorWithOpacity("--vscode-editorWidget-background"),
			// 	// 	foreground: createColorWithOpacity("--vscode-editorWidget-foreground"),
			// 	// },
			// 	chart: {
			// 		1: createColorWithOpacity("--vscode-charts-red"),
			// 		2: createColorWithOpacity("--vscode-charts-blue"),
			// 		3: createColorWithOpacity("--vscode-charts-yellow"),
			// 		4: createColorWithOpacity("--vscode-charts-orange"),
			// 		5: createColorWithOpacity("--vscode-charts-green"),
			// 	},
			// },
			keyframes: {
				"accordion-down": {
					from: {
						height: "0",
					},
					to: {
						height: "var(--radix-accordion-content-height)",
					},
				},
				"accordion-up": {
					from: {
						height: "var(--radix-accordion-content-height)",
					},
					to: {
						height: "0",
					},
				},
				"border-beam": {
					"100%": {
						"offset-distance": "100%",
					},
				},
			},

			animation: {
				"accordion-down": "accordion-down 0.2s ease-out",
				"accordion-up": "accordion-up 0.2s ease-out",
				"border-beam": "border-beam calc(var(--duration)*1s) infinite linear",
			},
		},
	},
	plugins: [
		require("tailwindcss-animate"),

		plugin(function ({ addUtilities, theme }) {
			const colors = theme("colors")
			const newUtilities = {}

			Object.entries(colors).forEach(([colorName, colorValue]) => {
				if (typeof colorValue === "object") {
					Object.entries(colorValue).forEach(([shade, shadeValue]) => {
						if (typeof shadeValue === "function") {
							;[10, 20, 30, 40, 50, 60, 70, 80, 90].forEach((opacity) => {
								const className =
									shade === "DEFAULT"
										? `.bg-${colorName}/${opacity}`
										: `.bg-${colorName}-${shade}/${opacity}`
								newUtilities[className] = {
									backgroundColor: shadeValue({ opacityValue: opacity / 100 }),
								}
							})
						}
					})
				} else if (typeof colorValue === "function") {
					;[10, 20, 30, 40, 50, 60, 70, 80, 90].forEach((opacity) => {
						newUtilities[`.bg-${colorName}/${opacity}`] = {
							backgroundColor: colorValue({ opacityValue: opacity / 100 }),
						}
					})
				}
			})
			addUtilities(newUtilities)
		}),
	],
}
