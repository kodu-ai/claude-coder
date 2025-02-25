import { TeachingBotHandler } from "./teaching-bot"
import { TeachingBotMessage, TeachingBotResponse } from "./types/teaching-bot"
import { WebviewManager } from "../../webview/webview-manager"
import { ApiHandler } from "./types"

export class TeachingBotMessageHandler {
    private teachingBot: TeachingBotHandler
    private webviewManager: WebviewManager
    private mainChatbot: ApiHandler

    constructor(teachingBot: TeachingBotHandler, webviewManager: WebviewManager, mainChatbot: ApiHandler) {
        this.teachingBot = teachingBot
        this.webviewManager = webviewManager
        this.mainChatbot = mainChatbot
    }

    async handleMessage(message: TeachingBotMessage): Promise<void> {
        let response: TeachingBotResponse = {
            type: "teachingBotResponse",
            message: ""
        }

        switch (message.message) {
            case "start_new_session":
                response = await this.handleStartNewSession()
                break
            case "end_session":
                response = await this.handleEndSession()
                break
            case "next_topic":
                response = await this.handleNextTopic()
                break
            case "review_topic":
                response = await this.handleReviewTopic()
                break
            default:
                response = await this.handleCustomMessage(message)
        }

        this.webviewManager.postMessageToWebview(response)
    }

    private async handleStartNewSession(): Promise<TeachingBotResponse> {
        // Komunikacja z głównym chatbotem
        const mainBotResponse = await this.teachingBot.communicateWithMainBot(
            "Let's start a new learning session. What would you like to learn about?"
        )

        // Analiza odpowiedzi i utworzenie ścieżki nauczania
        const learningPath = ["Introduction", "Basic Concepts", "Advanced Topics", "Practice"]
        
        return {
            type: "teachingBotResponse",
            message: mainBotResponse,
            topic: "Getting Started",
            progress: 0,
            learningPath,
            resources: [
                "Documentation",
                "Tutorial",
                "Best Practices Guide"
            ]
        }
    }

    private async handleEndSession(): Promise<TeachingBotResponse> {
        const mainBotResponse = await this.teachingBot.communicateWithMainBot(
            "Let's summarize what we've learned in this session."
        )

        return {
            type: "teachingBotResponse",
            message: mainBotResponse,
            progress: 100
        }
    }

    private async handleNextTopic(): Promise<TeachingBotResponse> {
        const mainBotResponse = await this.teachingBot.communicateWithMainBot(
            "Let's move on to the next topic."
        )

        // Aktualizacja postępu i zasobów
        return {
            type: "teachingBotResponse",
            message: mainBotResponse,
            progress: 50,
            resources: [
                "Advanced Documentation",
                "Practice Exercises",
                "Code Examples"
            ]
        }
    }

    private async handleReviewTopic(): Promise<TeachingBotResponse> {
        const mainBotResponse = await this.teachingBot.communicateWithMainBot(
            "Let's review the current topic."
        )

        return {
            type: "teachingBotResponse",
            message: mainBotResponse,
            resources: [
                "Review Materials",
                "Practice Questions",
                "Additional Examples"
            ]
        }
    }

    private async handleCustomMessage(message: TeachingBotMessage): Promise<TeachingBotResponse> {
        const mainBotResponse = await this.teachingBot.communicateWithMainBot(message.message)

        // Analiza odpowiedzi i aktualizacja stanu nauczania
        return {
            type: "teachingBotResponse",
            message: mainBotResponse,
            topic: message.topic,
            progress: message.progress,
            learningPath: message.learningPath,
            resources: message.resources
        }
    }
}