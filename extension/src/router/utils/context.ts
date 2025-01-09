// context.ts

import { ExtensionProvider } from "../../providers/extension-provider"

/**
 * Example extension context.
 *
 * For a VS Code extension, you might have references to:
 *   - a 'provider' class
 *   - user info
 *   - workspace data, etc.
 */
export interface ExtensionContext {
	provider: ExtensionProvider
	userId?: string
}
