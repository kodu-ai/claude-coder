import React from "react"
import { createRoot } from "react-dom/client"
import { PromptEditor } from "./components/prompt-editor"
import { TooltipProvider } from "./components/ui/tooltip"
import "./App.css"
import "./index.css"

const App = () => {
	return (
		<>
			<TooltipProvider>
				<div className="container mx-auto px-4 max-[280px]:px-2 py-4 max-w-screen-xl flex flex-col h-full">
					<PromptEditor />
				</div>
			</TooltipProvider>
		</>
	)
}

const root = createRoot(document.getElementById("root")!)
root.render(
	<React.StrictMode>
		<App />
	</React.StrictMode>
)
