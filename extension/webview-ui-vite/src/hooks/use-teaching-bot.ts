import { useCallback, useEffect } from "react"
import { useAtom } from "jotai"
import { teachingStateAtom } from "../components/teaching-view/atoms"
import { vscode } from "@/utils/vscode"

export const useTeachingBot = () => {
    const [teachingState, setTeachingState] = useAtom(teachingStateAtom)

    // Obsługa wiadomości od bota nauczającego
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data
            if (message.type === "teachingBotResponse") {
                setTeachingState(prev => ({
                    ...prev,
                    currentTopic: message.topic ?? prev.currentTopic,
                    progress: message.progress ?? prev.progress,
                    learningPath: message.learningPath ?? prev.learningPath,
                    resources: message.resources ?? prev.resources
                }))
            }
        }

        window.addEventListener("message", handleMessage)
        return () => window.removeEventListener("message", handleMessage)
    }, [setTeachingState])

    // Wysyłanie wiadomości do bota nauczającego
    const sendMessage = useCallback((message: string) => {
        vscode.postMessage({
            type: "teachingBotMessage",
            message
        })
    }, [])

    // Rozpoczęcie nowej sesji nauczania
    const startNewSession = useCallback(() => {
        setTeachingState(prev => ({ ...prev, isActive: true }))
        sendMessage("start_new_session")
    }, [sendMessage, setTeachingState])

    // Zakończenie sesji nauczania
    const endSession = useCallback(() => {
        setTeachingState(prev => ({ ...prev, isActive: false }))
        sendMessage("end_session")
    }, [sendMessage, setTeachingState])

    // Przejście do następnego tematu
    const nextTopic = useCallback(() => {
        sendMessage("next_topic")
    }, [sendMessage])

    // Powtórzenie aktualnego tematu
    const reviewTopic = useCallback(() => {
        sendMessage("review_topic")
    }, [sendMessage])

    // Aktualizacja postępu
    const updateProgress = useCallback((progress: number) => {
        setTeachingState(prev => ({ ...prev, progress }))
    }, [setTeachingState])

    return {
        teachingState,
        startNewSession,
        endSession,
        nextTopic,
        reviewTopic,
        updateProgress,
        sendMessage
    }
}