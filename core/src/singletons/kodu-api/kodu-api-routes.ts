// const KODU_BASE_URL = "http://localhost:3000"
const KODU_BASE_URL = "https://www.kodu.ai"

export function getKoduSignInUrl(uriScheme?: string, extensionName?: string) {
	return `${KODU_BASE_URL}/auth/login?redirectTo=${uriScheme}://kodu-ai.${extensionName}&ext=1`
}

export function getKoduReferUrl(_uriScheme?: string) {
	return `${KODU_BASE_URL}/dashboard/referrals`
}

export function getKoduOfferUrl(_uriScheme?: string) {
	return `${KODU_BASE_URL}/dashboard/offerwall`
}

export function getKoduAddCreditsUrl(_uriScheme?: string) {
	return `${KODU_BASE_URL}/pricing`
}

export function getKoduCurrentUser() {
	return `${KODU_BASE_URL}/api/me`
}

export function getKoduVisitorUrl() {
	return `${KODU_BASE_URL}/api/extension/visitor`
}

export function getKoduInferenceUrl() {
	return `${KODU_BASE_URL}/api/inference-stream`
}

export function getKoduBugReportUrl() {
	return `${KODU_BASE_URL}/api/bug-report`
}

export function getKoduSummarizeUrl() {
	return `${KODU_BASE_URL}/api/tools/summarize`
}

export function getKoduWebSearchUrl() {
	return `${KODU_BASE_URL}/api/tools/web-search`
}

export function getKoduScreenshotUrl() {
	return `${KODU_BASE_URL}/api/tools/screenshot`
}

export function getKoduConsultantUrl() {
	return `${KODU_BASE_URL}/api/tools/consultant`
}

export function getKoduHomepageUrl() {
	return `${KODU_BASE_URL}`
}