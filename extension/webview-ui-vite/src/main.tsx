import React from "react"
import App from "./App"
import { createRoot } from "react-dom/client"
import "./index.css"

const container = document.getElementById("root")
// container?.style.setProperty("display", "flex")
// container?.style.setProperty("flexDirection", "column")
container?.style.setProperty("height", "100%")
container?.style.setProperty("width", "100%")

const root = createRoot(container!) // createRoot(container!) if you use TypeScript
root.render(
	<React.StrictMode>
		<App />
	</React.StrictMode>
)
