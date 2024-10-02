import { chromium, Browser, Page } from "playwright"

export class BrowserManager {
	private browser?: Browser
	private page?: Page

	async launchBrowser(): Promise<void> {
		if (this.browser) {
			return
		}

		this.browser = await chromium.launch({
			channel: "chrome", // This will use the system Chrome if available
			args: ["--no-sandbox", "--disable-setuid-sandbox"],
			headless: true,
		})

		this.page = await this.browser.newPage({
			userAgent:
				"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
		})
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
			await this.page.goto(url, { timeout: 10000, waitUntil: "domcontentloaded" })
		} catch (err) {
			logs.push(`[Navigation Error] ${err}`)
		}

		// Wait a bit for any remaining logs
		await this.page.waitForTimeout(1000)

		const screenshotBuffer = await this.page.screenshot({
			fullPage: true,
			type: "jpeg",
		})

		return { buffer: screenshotBuffer, logs }
	}
}
