import { mkdir, mkdirSync } from "fs"
import { join } from "path"
// @ts-expect-error - not typed
import PCR from "puppeteer-chromium-resolver"

import puppeteer, { Browser, launch, Page } from "puppeteer-core"
import * as vscode from "vscode"
import { fileExistsAtPath } from "../../utils/path-helpers"
interface PCRStats {
	puppeteer: { launch: typeof launch }
	executablePath: string
}
export class BrowserManager {
	private browser?: Browser
	private page?: Page
	private context: vscode.ExtensionContext

	constructor(context: vscode.ExtensionContext) {
		this.context = context
	}

	private async ensureChromiumExists(): Promise<PCRStats> {
		const globalStoragePath = this.context?.globalStorageUri?.fsPath
		if (!globalStoragePath) {
			throw new Error("Global storage uri is invalid")
		}

		const puppeteerDir = join(globalStoragePath, "puppeteer")
		const dirExists = await fileExistsAtPath(puppeteerDir)
		if (!dirExists) {
			await mkdirSync(puppeteerDir, { recursive: true })
		}

		// if chromium doesn't exist, this will download it to path.join(puppeteerDir, ".chromium-browser-snapshots")
		// if it does exist it will return the path to existing chromium
		const stats: PCRStats = await PCR({
			downloadPath: puppeteerDir,
		})

		return stats
	}

	async launchBrowser(): Promise<void> {
		if (this.browser) {
			return
		}
		const stats = await this.ensureChromiumExists()
		this.browser = await puppeteer.launch({
			args: ["--no-sandbox", "--disable-setuid-sandbox"],
			executablePath: stats.executablePath,
			headless: true,
		})

		this.page = await this.browser.newPage()
		await this.page.setUserAgent(
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
		)
	}

	async closeBrowser(): Promise<void> {
		await this.browser?.close()
		this.browser = undefined
		this.page = undefined
	}

	async urlToScreenshotAndLogs(url: string): Promise<{ buffer: Buffer; logs: string[] }> {
		if (!this.page) {
			throw new Error("Browser not initialized")
		}

		const logs: string[] = []

		this.page.on("console", (msg) => {
			logs.push(`[${msg.type()}] ${msg.text()}`)
		})

		try {
			await this.page.goto(url, { timeout: 25000, waitUntil: "domcontentloaded" })
		} catch (err) {
			logs.push(`[Navigation Error] ${err}`)
		}

		// Wait a bit for any remaining logs
		await new Promise((resolve) => setTimeout(resolve, 2000))

		const screenshotUInt = await this.page.screenshot({
			fullPage: true,
			type: "jpeg",
		})
		const screenshotBuffer = Buffer.from(screenshotUInt)

		return { buffer: screenshotBuffer, logs }
	}
}
