import { SpawnAgentOptions } from "../tools/schema/agents/agent-spawner";
import { SubAgentState } from "../types";
import { IOManager } from "./io-manager";
type SubAgentManagerOptions = {
    ioManager: IOManager;
    subAgentId?: number;
    onEnterSucessful: (state: SubAgentState) => Promise<void>;
    onExit: () => Promise<void>;
};
export declare class SubAgentManager {
    private _ioManager;
    private _state?;
    private _currentSubAgentId?;
    private _agentHash?;
    private onEnterSucessful;
    private onExit;
    constructor(options: SubAgentManagerOptions);
    get state(): SubAgentState | undefined;
    get agentName(): SpawnAgentOptions | undefined;
    get agentHash(): string | undefined;
    get currentSubAgentId(): number | undefined;
    get isInSubAgent(): boolean;
    exitSubAgent(): Promise<void>;
    getHash(): string;
    updateSubAgentState(subAgentId: number, state: SubAgentState): Promise<void>;
    enterSubAgent(subAgentId: number): Promise<void>;
    spawnSubAgent(subAgentId: number, subAgentState: SubAgentState): Promise<void>;
}
export {};
