import React from "react"
import { useTeachingBot } from "@/hooks/use-teaching-bot"
import { useExtensionState } from "@/context/extension-state-context"
import { Button } from "../ui/button"
import { Card } from "../ui/card"
import { Progress } from "../ui/progress"

interface TeachingViewProps {
    isHidden: boolean
}

const TeachingView: React.FC<TeachingViewProps> = ({ isHidden }) => {
    const { currentTask } = useExtensionState()
    const {
        teachingState,
        startNewSession,
        nextTopic,
        reviewTopic
    } = useTeachingBot()

    return (
        <div
            className={`h-full teaching-container ${isHidden ? "hidden" : ""}`}
            style={{
                display: isHidden ? "none" : "flex",
                flexDirection: "column",
                padding: "1rem",
                gap: "1rem"
            }}>
            
            {/* Nagłówek z aktualnym tematem */}
            <Card className="p-4">
                <h2 className="text-xl font-bold mb-2">Current Topic: {teachingState.currentTopic || "No topic selected"}</h2>
                <Progress value={teachingState.progress} className="w-full" />
                <div className="mt-2 text-sm text-gray-500">
                    Progress: {teachingState.progress}%
                </div>
            </Card>

            {/* Ścieżka nauczania */}
            <Card className="p-4">
                <h3 className="text-lg font-semibold mb-2">Learning Path</h3>
                <ul className="space-y-2">
                    {teachingState.learningPath.map((step, index) => (
                        <li key={index} className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white">
                                {index + 1}
                            </div>
                            <span>{step}</span>
                        </li>
                    ))}
                </ul>
            </Card>

            {/* Dodatkowe zasoby */}
            <Card className="p-4">
                <h3 className="text-lg font-semibold mb-2">Additional Resources</h3>
                <ul className="space-y-2">
                    {teachingState.resources.map((resource, index) => (
                        <li key={index} className="text-blue-500 hover:underline cursor-pointer">
                            {resource}
                        </li>
                    ))}
                </ul>
            </Card>

            {/* Przyciski kontrolne */}
            <div className="flex gap-2 mt-auto">
                <Button onClick={startNewSession}>
                    Start New Session
                </Button>
                <Button onClick={nextTopic} variant="outline">
                    Next Topic
                </Button>
                <Button onClick={reviewTopic} variant="outline">
                    Review Topic
                </Button>
            </div>
        </div>
    )
}

export default React.memo(TeachingView)