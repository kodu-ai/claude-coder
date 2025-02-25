import { atom } from "jotai"

export interface TeachingState {
    currentTopic: string
    progress: number
    learningPath: string[]
    resources: string[]
    isActive: boolean
}

export const teachingStateAtom = atom<TeachingState>({
    currentTopic: "",
    progress: 0,
    learningPath: [],
    resources: [],
    isActive: false
})