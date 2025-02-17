export type WebSearchResponseDto = {
    content: string;
    type: "start" | "explore" | "summarize" | "end";
};
export type AskConsultantResponseDto = {
    result: string;
};
export type SummaryResponseDto = {
    result: string;
};
