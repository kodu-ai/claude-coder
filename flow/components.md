# Claude Dev Agent System Components

This document provides a detailed description of the main components in the Claude Dev agent system.

## 1. KoduDev (index.ts)

KoduDev is the central class that orchestrates the entire system. It's responsible for:

- Initializing other components (ApiManager, StateManager, TaskExecutor, ToolExecutor)
- Coordinating interactions between components
- Handling user input and presenting results
- Managing the overall flow of task execution

## 2. ApiManager (api-handler.ts)

ApiManager is responsible for handling all API communications. Its main functions include:

- Sending requests to the AI model
- Processing responses from the AI model
- Managing API configurations
- Handling retries and error cases in API communication

## 3. StateManager (state-manager.ts)

StateManager is crucial for maintaining the system's state. It handles:

- Storing and updating the current state of the system
- Managing conversation history
- Tracking API requests and responses
- Persisting state information for task resumption

## 4. TaskExecutor (task-executor.ts)

TaskExecutor is responsible for executing tasks. Its main functions are:

- Breaking down tasks into manageable steps
- Coordinating with ApiManager for AI-driven decisions
- Utilizing ToolExecutor for specific actions
- Managing the flow of task execution
- Handling task completion and user feedback

## 5. ToolExecutor (tool-executor.ts)

ToolExecutor handles the execution of individual tools. It's capable of:

- Performing file system operations (read, write, list files)
- Executing system commands
- Conducting web searches
- Extracting code definitions
- Asking follow-up questions to the user

## 6. System Prompts (system-prompt.ts)

This component defines the system prompts used to set up the context for the AI model. It includes:

- Detailed instructions for the AI model
- Rules and guidelines for task execution
- Information about the system's capabilities and limitations

## 7. Constants (constants.ts)

The Constants file stores configuration values used throughout the system, including:

- Default values for various settings
- Timeouts and delays
- Other system-wide constants

These components work together to create a flexible and powerful system capable of handling a wide range of software development tasks. Their modular design allows for easy maintenance and extension of the system's capabilities.