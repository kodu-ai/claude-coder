const plugin = require("tailwindcss/plugin")
const Color = require("color")

function hexToRGB(hex) {
	const color = Color(hex)
	return color.rgb().array()
}

function addOpacityToHex(colors) {
	const newColors = {}

	for (const [key, value] of Object.entries(colors)) {
		if (typeof value === "string" && value.startsWith("#")) {
			const [r, g, b] = hexToRGB(value)
			newColors[key] = ({ opacityValue }) => {
				if (opacityValue === undefined) {
					return `rgb(${r}, ${g}, ${b})`
				}
				return `rgba(${r}, ${g}, ${b}, ${opacityValue})`
			}
		} else if (typeof value === "object" && value !== null) {
			newColors[key] = addOpacityToHex(value)
		} else {
			newColors[key] = value
		}
	}

	return newColors
}

module.exports = plugin(
	function () {}, // This plugin doesn't inject any CSS
	{
		theme: {
			extend: {
				colors: (theme) => addOpacityToHex(theme("colors")),
			},
		},
	}
)
