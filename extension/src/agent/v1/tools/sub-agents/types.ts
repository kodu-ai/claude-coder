import { Tool } from "../schema"
import { KoduDevOptions } from "../../types"
import { SubAgentToolParams as SchemaSubAgentToolParams } from "../schema/sub_agent"

/**
 * Configuration options for a sub-agent
 */
export interface SubAgentOptions {
    /**
     * List of tools this sub-agent has access to
     */
    allowedTools?: Tool["schema"]["name"][]
    
    /**
     * Custom prompt/instructions for this sub-agent
     */
    agentPrompt: string
    
    /**
     * Name of the sub-agent for identification
     */
    agentName: string
    
    /**
     * Optional memory/context to initialize the sub-agent with
     */
    initialMemory?: string
}

/**
 * Tool parameters for the sub-agent tool
 */
export type SubAgentToolParams = SchemaSubAgentToolParams

/**
 * State specific to sub-agents
 */
export interface SubAgentState {
    /**
     * Parent agent's task ID
     */
    parentTaskId: string
    
    /**
     * Sub-agent specific memory/context
     */
    agentMemory?: string
    
    /**
     * Tools this agent has access to
     */
    allowedTools: Tool["schema"]["name"][]
}