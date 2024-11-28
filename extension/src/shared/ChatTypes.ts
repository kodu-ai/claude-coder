export type ChatMode = 'task' | 'chat' | 'code';

export interface ChatMessage {
    id: string;
    content: string;
    role: 'user' | 'assistant';
    timestamp: number;
    images?: string[];
}

export interface ChatState {
    mode: ChatMode;
    history: ChatMessage[];
    isTyping?: boolean;
}

export interface ChatSystemPrompts {
    [key in ChatMode]: string;
}

export const DEFAULT_SYSTEM_PROMPTS: ChatSystemPrompts = {
    chat: 'You are a helpful AI assistant engaging in casual conversation.',
    task: 'You are an AI coding assistant helping with development tasks.',
    code: 'You are an AI programming expert focused on writing and explaining code.'
};
