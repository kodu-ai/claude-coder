#!/usr/bin/env node

import { KoduDev, KoduDevOptions } from "../../index"
import { TaskState } from "@/types"
import path from "path"
import os from "os"
import { CliConsumer } from "./cli-consumer"

const task = process.argv[2]

if (!task) {
	console.error("Please provide a task as a command-line argument.")
	process.exit(1)
}

// Create a new instance of KoduDev
const options: KoduDevOptions = {
	apiConfiguration: {
		// Add your API configuration here
		// For example:
		// apiKey: process.env.ANTHROPIC_API_KEY,
	},
	customInstructions: "Your custom instructions here",
	task: task,
	images: [], // Add any images if needed
	globalStoragePath: path.join(os.homedir(), ".kodu-dev"),
}

const koduDev = new KoduDev(options, new CliConsumer())

async function runKoduDevTask() {
	try {
		console.log("Starting task:", task)

		// The task is already started in the KoduDev constructor
		// We just need to wait for it to complete or require user input
		while (koduDev.taskExecutor.state !== TaskState.IDLE && koduDev.taskExecutor.state !== TaskState.ABORTED) {
			if (koduDev.taskExecutor.state === TaskState.WAITING_FOR_USER) {
				// In a real CLI, you'd prompt for user input here
				const userInput = await promptUser("Claude is waiting for input. Please provide your response:")
				await koduDev.handleWebviewAskResponse("messageResponse", userInput)
			} else {
				// Wait for a short time before checking the state again
				await new Promise((resolve) => setTimeout(resolve, 1000))
			}

			// Log the current state (you might want to remove this in a production CLI)
			console.log("Current state:", koduDev.taskExecutor.state)
		}

		if (koduDev.taskExecutor.state === TaskState.IDLE) {
			console.log("Task completed successfully.")
		} else {
			console.log("Task aborted or failed.")
		}
	} catch (error) {
		console.error("An error occurred:", error)
	} finally {
		// Ensure we always close the browser and dispose of terminals
		await koduDev.abortTask()
	}
}

// Helper function to prompt for user input (you'd replace this with a real CLI input library in practice)
async function promptUser(question: string): Promise<string> {
	return new Promise((resolve) => {
		console.log(question)
		process.stdin.once("data", (data) => {
			resolve(data.toString().trim())
		})
	})
}

runKoduDevTask().catch(console.error)
