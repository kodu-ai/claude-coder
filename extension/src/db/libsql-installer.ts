// src/db/libsqlInstaller.ts
import { execSync } from "child_process"
import os from "os"
import path from "path"
import fs from "fs"
import * as vscode from "vscode"
/**
 * A singleton class that:
 * 1. Detects OS + Arch
 * 2. Installs the correct @libsql/client variant (e.g., wasm or node)
 * 3. Dynamically imports and returns the client
 */
export class LibSQLInstaller {
	private static instance: LibSQLInstaller
	private libSQLClient: any // Will hold the dynamic import result
	private installed = false // Tracks whether we've already done the install

	private constructor() {
		// private constructor => use getInstance()
	}

	/** Singleton accessor. */
	public static getInstance(): LibSQLInstaller {
		if (!LibSQLInstaller.instance) {
			LibSQLInstaller.instance = new LibSQLInstaller()
		}
		return LibSQLInstaller.instance
	}

	/**
	 * Public method to ensure the correct libsql client is installed
	 * and then load it. You can call this once at startup (e.g., in your main).
	 */
	public async installAndLoad(): Promise<void> {
		if (this.installed) {
			// Already installed and loaded
			return
		}

		const { platform, arch } = this.detectPlatformAndArch()
		console.log(`[LibSQLInstaller] Detected platform=${platform}, arch=${arch}`)

		// Decide which npm package to install
		// for example, if you want the WASM version on Windows, or the Node version on Linux, etc.
		// In reality, you might want a more robust mapping of platform -> package.
		const pkgToInstall = this.decideLibSQLPackage(platform, arch)

		// Actually install the package (if needed).
		this.installLibSQL(pkgToInstall)

		// Now dynamically import the library from node_modules
		this.libSQLClient = await this.dynamicImportLibSQL(pkgToInstall)

		this.installed = true
	}

	/**
	 * After calling `installAndLoad()`, you can retrieve the actual client
	 * (the default export or named exports—depending on the library).
	 */
	public getClient(): any {
		if (!this.installed) {
			throw new Error("LibSQLInstaller not installed yet. Call installAndLoad() first.")
		}
		return this.libSQLClient
	}

	/**
	 * Determine OS + architecture
	 * (You can refine as needed for your environment.)
	 */
	private detectPlatformAndArch(): { platform: string; arch: string } {
		// E.g. 'darwin', 'win32', 'linux'
		const platform = os.platform()
		// E.g. 'arm64', 'x64'
		const arch = os.arch()
		return { platform, arch }
	}

	/**
	 * Example logic to choose which @libsql/client variant to install.
	 * Adjust for your real constraints.
	 */
	private decideLibSQLPackage(platform: string, arch: string): string {
		// For illustration:
		// - On Windows or Darwin -> use '@libsql/client-wasm'
		// - On Linux x64 -> use '@libsql/client' (the Node version)
		// - On Linux arm64 -> also use wasm or some custom?
		// Adjust to your scenario.
		// if (platform === "win32" || platform === "darwin") {
		return "@libsql/client-wasm"
		// }
		// Fallback: real native client for Linux x64, etc.
		return "@libsql/client"
	}

	/**
	 * Uses child_process to install the given package.
	 * NOTE: This is somewhat unorthodox in production code.
	 */
	private installLibSQL(packageName: string): void {
		// Check if it’s already installed to avoid re-installing
		const nodeModulesPath = path.join(__dirname, "../../..", "node_modules", packageName)
		if (fs.existsSync(nodeModulesPath)) {
			console.log(`[LibSQLInstaller] ${packageName} already exists, skipping install.`)
			return
		}

		console.log(`[LibSQLInstaller] Installing ${packageName} via npm...`)
		vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: `Installing local database`,
				cancellable: false,
			},
			async (progress) => {
				progress.report({ increment: 0 })
				try {
					execSync(`npm install ${packageName} --save`, {
						stdio: "inherit",
						cwd: path.join(__dirname, "../../.."), // or wherever your package.json is
					})
					progress.report({ increment: 100, message: "Local database installed successfully" })
				} catch (error) {
					progress.report({ increment: 100, message: "Failed to install local database" })
					vscode.window.showErrorMessage(`Failed to install local database`)
					console.error(`[LibSQLInstaller] Failed to install ${packageName}:`, error)
					throw error
				}
				console.log(`[LibSQLInstaller] ${packageName} installed successfully.`)
			}
		)
	}

	/**
	 * Dynamically imports the installed library from node_modules
	 */
	private async dynamicImportLibSQL(pkgName: string): Promise<any> {
		console.log(`[LibSQLInstaller] Dynamically importing ${pkgName}`)
		// ESM dynamic import
		const lib = await import(pkgName)
		return lib
	}
}
