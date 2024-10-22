import React from 'react'
import './index.css'
import { createRoot } from 'react-dom/client'
import App from './App'

const container = document.getElementById('root')
// container?.style.setProperty("display", "flex")
// container?.style.setProperty("flexDirection", "column")
container?.style.setProperty('height', '100%')
container?.style.setProperty('width', '100%')

const root = createRoot(container!) // createRoot(container!) if you use TypeScript
root.render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
)
