import { mkdir, mkdirSync } from "fs"
import { join } from "path"
// @ts-expect-error - not typed
import PCR from "puppeteer-chromium-resolver"

import puppeteer, { Browser, launch, Page, TimeoutError, ScreenshotOptions } from "puppeteer-core"
import * as vscode from "vscode"
import { fileExistsAtPath } from "../../utils/path-helpers"
import delay from "delay"
import pWaitFor from "p-wait-for"
import { BrowserActionResult } from "./types/browser"

interface PCRStats {
	puppeteer: { launch: typeof launch }
	executablePath: string
}
export class BrowserManager {
	private browser?: Browser
	private page?: Page
	private context: vscode.ExtensionContext
	private currentMousePosition?: string

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
			defaultViewport: {
				width: 900,
				height: 600,
			},
		})

		this.page = await this.createNewPage()
	}

	async createNewPage(): Promise<Page> {
		const page = await this.browser?.newPage()
		await page?.setUserAgent(
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
		)

		if (!page) {
			throw new Error("Failed to create new page")
		}

		return page
	}

	async closeBrowser(): Promise<void> {
		const now = Date.now()
		await this.browser?.close()
		this.browser = undefined
		this.page = undefined
		console.log(`Browser closed in ${Date.now() - now}ms`)
	}

	async urlToScreenshotAndLogs(url: string): Promise<{ buffer: Buffer; logs: string[] }> {
		if (!this.page) {
			throw new Error("Browser not initialized")
		}

		const logs: string[] = []

		this.page.on("console", (msg) => {
			if (msg.type() === "error") {
				console.error(`[Browser Error] ${msg.text()}`)
			} else {
				logs.push(`[${msg.type()}] ${msg.text()}`)
			}
		})

		try {
			await this.page.goto(url, { timeout: 8000, waitUntil: "domcontentloaded" })
		} catch (err) {
			logs.push(`[Navigation Error] ${err}`)
		}

		// Wait a bit for any remaining logs
		await new Promise((resolve) => setTimeout(resolve, 5000))

		const screenshotUInt = await this.page.screenshot({
			fullPage: true,
			type: "jpeg",
		})
		const screenshotBuffer = Buffer.from(screenshotUInt)

		return { buffer: screenshotBuffer, logs }
	}

	async navigateToUrl(url: string): Promise<BrowserActionResult> {
		return this.doAction(async (page) => {
			this.page = await this.createNewPage()
			await this.page.goto(url, { timeout: 7_000, waitUntil: ["domcontentloaded", "networkidle2"] })
			await this.waitTillHTMLStable(this.page)
		})
	}

	async click(coordinate: string): Promise<BrowserActionResult> {
		const [x, y] = coordinate.split(",").map(Number)
		return this.doAction(async (page) => {
			// Set up network request monitoring
			let hasNetworkActivity = false
			const requestListener = () => {
				hasNetworkActivity = true
			}
			page.on("request", requestListener)

			// Perform the click
			await page.mouse.click(x, y)
			this.currentMousePosition = coordinate

			// Small delay to check if click triggered any network activity
			await delay(100)

			if (hasNetworkActivity) {
				// If we detected network activity, wait for navigation/loading
				await page
					.waitForNavigation({
						waitUntil: ["domcontentloaded", "networkidle2"],
						timeout: 7000,
					})
					.catch(() => {})
				await this.waitTillHTMLStable(page)
			}

			// Clean up listener
			page.off("request", requestListener)
		})
	}

	async type(text: string): Promise<BrowserActionResult> {
		return this.doAction(async (page) => {
			await page.keyboard.type(text)
		})
	}

	async scrollDown(): Promise<BrowserActionResult> {
		return this.doAction(async (page) => {
			await page.evaluate(() => {
				window.scrollBy({
					top: 600,
					behavior: "auto",
				})
			})
			await delay(300)
		})
	}

	async scrollUp(): Promise<BrowserActionResult> {
		return this.doAction(async (page) => {
			await page.evaluate(() => {
				window.scrollBy({
					top: -600,
					behavior: "auto",
				})
			})
			await delay(300)
		})
	}

	async doAction(action: (page: Page) => Promise<void>): Promise<BrowserActionResult> {
		if (!this.browser) {
			throw new Error("Browser not initialized")
		}

		if (!this.page) {
			throw new Error(
				"Browser is not launched. This may occur if the browser was automatically closed by a non-`computer_use` tool."
			)
		}

		const logs: string[] = []
		let lastLogTs = Date.now()

		const consoleListener = (msg: any) => {
			if (msg.type() === "log") {
				logs.push(msg.text())
			} else {
				logs.push(`[${msg.type()}] ${msg.text()}`)
			}
			lastLogTs = Date.now()
		}

		const errorListener = (err: Error) => {
			logs.push(`[Page Error] ${err.toString()}`)
			lastLogTs = Date.now()
		}

		// Add the listeners
		this.page.on("console", consoleListener)
		this.page.on("pageerror", errorListener)

		try {
			await action(this.page)
		} catch (err) {
			if (!(err instanceof TimeoutError)) {
				logs.push(`[Error] ${err?.toString()}`)
			}
		}

		// Wait for console inactivity, with a timeout
		await pWaitFor(() => Date.now() - lastLogTs >= 500, {
			timeout: 3_000,
			interval: 100,
		}).catch(() => {})

		let options: ScreenshotOptions = {
			encoding: "base64",

			// clip: {
			// 	x: 0,
			// 	y: 0,
			// 	width: 900,
			// 	height: 600,
			// },
		}

		let screenshotBase64 = await this.page.screenshot({
			...options,
			type: "webp",
		})
		let screenshot = `data:image/webp;base64,${screenshotBase64}`

		if (!screenshotBase64) {
			console.log("webp screenshot failed, trying png")
			screenshotBase64 = await this.page.screenshot({
				...options,
				type: "png",
			})
			screenshot = `data:image/png;base64,${screenshotBase64}`
		}

		if (!screenshotBase64) {
			throw new Error("Failed to take screenshot.")
		}

		// this.page.removeAllListeners() <- causes the page to crash!
		this.page.off("console", consoleListener)
		this.page.off("pageerror", errorListener)

		return {
			screenshot,
			logs: logs.join("\n"),
			currentUrl: this.page.url(),
			currentMousePosition: this.currentMousePosition,
		}
	}

	private async waitTillHTMLStable(page: Page, timeout = 5_000) {
		const checkDurationMsecs = 500 // 1000
		const maxChecks = timeout / checkDurationMsecs
		let lastHTMLSize = 0
		let checkCounts = 1
		let countStableSizeIterations = 0
		const minStableSizeIterations = 3

		while (checkCounts++ <= maxChecks) {
			let html = await page.content()
			let currentHTMLSize = html.length

			// let bodyHTMLSize = await page.evaluate(() => document.body.innerHTML.length)
			console.log("last: ", lastHTMLSize, " <> curr: ", currentHTMLSize)

			if (lastHTMLSize !== 0 && currentHTMLSize === lastHTMLSize) {
				countStableSizeIterations++
			} else {
				countStableSizeIterations = 0 //reset the counter
			}

			if (countStableSizeIterations >= minStableSizeIterations) {
				console.log("Page rendered fully...")
				break
			}

			lastHTMLSize = currentHTMLSize
			await delay(checkDurationMsecs)
		}
	}
}
