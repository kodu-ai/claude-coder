declare const agentRouter: {
    getObserverSettings: import("../utils/procedure").ProcedureInstance<import("../utils/context").ExtensionContext, {}, {
        observerSettings: {
            modelId: string;
            providerId: import("../../api/providers/constants").ProviderId;
            observePullMessages: number;
            observeEveryXRequests: number;
            observePrompt?: string;
        } | undefined;
    }>;
    enableObserverAgent: import("../utils/procedure").ProcedureInstance<import("../utils/context").ExtensionContext, {
        enabled: boolean;
    }, {
        success: boolean;
    }>;
    updateObserverAgent: import("../utils/procedure").ProcedureInstance<import("../utils/context").ExtensionContext, {
        modelId?: string | undefined;
        observePullMessages?: number | undefined;
        observeEveryXRequests?: number | undefined;
        clearPrompt?: boolean | undefined;
    }, {
        success: boolean;
    }>;
    customizeObserverPrompt: import("../utils/procedure").ProcedureInstance<import("../utils/context").ExtensionContext, {}, {
        success: boolean;
    }>;
};
export default agentRouter;
