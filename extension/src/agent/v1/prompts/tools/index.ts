import { addInterestedFilePrompt } from "./add-interested-file"
import { fileEditorPrompt } from "./file-editor"
import { exploreRepoFolderPrompt } from "./explore-repo-folder"
import { searchFilesPrompt } from "./search-files"
import { searchSymbolPrompt } from "./search-symbol"
import { listFilesPrompt } from "./list-files"
import { readFilePrompt } from "./read-file"
import { executeCommandPrompt } from "./execute-command"
import { serverRunnerPrompt } from "./server-runner"
import { urlScreenshotPrompt } from "./url-screenshot"
import { attemptCompletionPrompt } from "./attempt-complete"
import { askFollowupQuestionPrompt } from "./ask-followup-question"
import { spawnAgentPrompt } from "./spawn-agent"

export const toolPrompts = [
	fileEditorPrompt,
	spawnAgentPrompt,
	exploreRepoFolderPrompt,
	readFilePrompt,
	addInterestedFilePrompt,
	searchFilesPrompt,
	searchSymbolPrompt,
	listFilesPrompt,
	executeCommandPrompt,
	serverRunnerPrompt,
	urlScreenshotPrompt,
	askFollowupQuestionPrompt,
	attemptCompletionPrompt,
	// submitReviewPrompt,
]
