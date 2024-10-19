import { IStateManager } from './IStateManager';
import { IToolExecutor } from './IToolExecutor';

/**
 * Represents the possible states of a task executor.
 */
export type TaskExecutorState = 'idle' | 'running' | 'paused' | 'completed' | 'error';

/**
 * Represents the content of a task or message.
 */
export interface TaskContent {
  text: string;
  images?: string[];
}

/**
 * Represents the response from an ask operation.
 */
export interface AskResponse {
  type: string;
  content: string;
}

/**
 * Manages the execution of tasks within the application.
 */
export interface ITaskExecutor {
  /**
   * The current state of the task executor.
   */
  state: TaskExecutorState;

  /**
   * Starts a new task with the given content.
   * @param content - The content of the task to start
   */
  startTask(content: TaskContent): Promise<void>;

  /**
   * Aborts the currently running task.
   */
  abortTask(): Promise<void>;

  /**
   * Handles the response from an ask operation.
   * @param askResponse - The response from the ask operation
   * @param text - Optional text associated with the response
   * @param images - Optional array of image URLs associated with the response
   */
  handleAskResponse(askResponse: AskResponse, text?: string, images?: string[]): void;

  /**
   * Adds a new message to the current task.
   * @param content - The content of the new message
   */
  newMessage(content: TaskContent): Promise<void>;

  /**
   * Sends a message of a specific type.
   * @param sayType - The type of message to send
   * @param text - Optional text content of the message
   * @param images - Optional array of image URLs to include in the message
   */
  say(sayType: string, text?: string, images?: string[]): Promise<void>;

  /**
   * Performs an ask operation of a specific type.
   * @param askType - The type of ask operation to perform
   * @returns A promise that resolves with the ask response
   */
  ask(askType: string): Promise<AskResponse>;
}

/**
 * Constructor interface for creating a new TaskExecutor instance.
 */
export interface TaskExecutorConstructor {
  new (stateManager: IStateManager, toolExecutor: IToolExecutor, providerRef: WeakRef<any>): ITaskExecutor;
}