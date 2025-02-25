import { ModelInfo } from "./providers/types"

export interface ShadowBilling {
    actualCost: number;  // Real cost that would be charged
    shadowCost: number;  // Cost for tracking only
    inputTokens: number;
    outputTokens: number;
    cacheCreationInputTokens: number;
    cacheReadInputTokens: number;
    model: ModelInfo;
    timestamp: number;
}

export class ShadowBillingManager {
    private static instance: ShadowBillingManager;
    private billingHistory: ShadowBilling[] = [];
    private isShadowMode: boolean = false;

    private constructor() {}

    public static getInstance(): ShadowBillingManager {
        if (!ShadowBillingManager.instance) {
            ShadowBillingManager.instance = new ShadowBillingManager();
        }
        return ShadowBillingManager.instance;
    }

    public enableShadowMode() {
        this.isShadowMode = true;
    }

    public disableShadowMode() {
        this.isShadowMode = false;
    }

    public isShadowModeEnabled(): boolean {
        return this.isShadowMode;
    }

    public trackBilling(billing: Omit<ShadowBilling, "timestamp">) {
        this.billingHistory.push({
            ...billing,
            timestamp: Date.now()
        });
    }

    public getBillingHistory(): ShadowBilling[] {
        return this.billingHistory;
    }

    public getTotalCost(): number {
        return this.billingHistory.reduce((total, bill) => total + bill.actualCost, 0);
    }

    public getTotalShadowCost(): number {
        return this.billingHistory.reduce((total, bill) => total + bill.shadowCost, 0);
    }

    public clearHistory() {
        this.billingHistory = [];
    }
}