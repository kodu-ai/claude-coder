export interface TeachingBotMessage {
    message: string;
    topic?: string;
    progress?: number;
    learningPath?: string[];
    resources?: string[];
}

export interface TeachingBotResponse {
    type: "teachingBotResponse";
    message: string;
    topic?: string;
    progress?: number;
    learningPath?: string[];
    resources?: string[];
}

export type TeachingBotMessageType = 
    | "start_new_session"
    | "end_session"
    | "next_topic"
    | "review_topic"
    | string;import { BaseProviderSettings } from "./base"

export interface TeachingBotSettings extends BaseProviderSettings {
    providerId: "teaching-bot"
    apiKey: string
    baseUrl?: string
}

export interface LearningProgress {
    topic: string
    status: "not_started" | "in_progress" | "completed"
    score: number
    lastUpdate: Date
}

export interface TeachingBotMessage {
    type: "teachingBotMessage"
    message: string
    topic?: string
    progress?: number
    learningPath?: string[]
    resources?: string[]
}

export interface TeachingBotResponse {
    type: "teachingBotResponse"
    message: string
    topic?: string
    progress?: number
    learningPath?: string[]
    resources?: string[]
}

export interface TeachingBotState {
    currentTopic: string
    progress: number
    learningPath: string[]
    resources: string[]
    isActive: boolean
}