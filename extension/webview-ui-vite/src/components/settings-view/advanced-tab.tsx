import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import React from "react"
import { useSettingsState } from "../../hooks/use-settings-state"
import { Slider } from "../ui/slider"
import { ExperimentalFeatureItem } from "./experimental-feature-item"
import { McpServerManagement } from "./mcp-server-management"
import { vscode } from "@/utils/vscode"

const AdvancedTab: React.FC = () => {
  const {
    readOnly,
    autoCloseTerminal,
    customInstructions,
    terminalCompressionThreshold,
    commandTimeout,
    gitHandlerEnabled,
    gitCommitterType,
    handleSetGitHandlerEnabled,
    handleSetGitCommitterType,
    handleCommandTimeout,
    handleTerminalCompressionThresholdChange,
    handleSetReadOnly,
    handleSetAutoCloseTerminal,
    handleAutoSkipWriteChange,
    handleCustomInstructionsChange,
  } = useSettingsState()

  const handleTextAreaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target
    const cursorPosition = textarea.selectionStart

    handleCustomInstructionsChange(e.target.value)

    // Restore cursor position after state update
    requestAnimationFrame(() => {
      textarea.selectionStart = cursorPosition
      textarea.selectionEnd = cursorPosition
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className={"flex items-center justify-between"}>
          <div className={"flex-1 pr-2"}>
            <Label htmlFor="customizePrompt" className="text-xs font-medium flex items-center">
              Customize Instructions
            </Label>
            <p className="text-[10px] text-muted-foreground">
              Let's you customize the instructions that Kodu will follow when executing Tasks. You can
              customize the tools and general instructions that Kodu will follow.
            </p>
          </div>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              vscode.postMessage({ type: "openPromptEditor" })
            }}>
            Open Editor
          </Button>
        </div>
        
        <McpServerManagement />

        <div className="space-y-4">
          <ExperimentalFeatureItem
            feature={{
              id: "gitHandlerEnabled",
              label: "Git Handler",
              description: "Enable or disable automatic git operations and version control",
            }}
            checked={gitHandlerEnabled}
            onCheckedChange={handleSetGitHandlerEnabled}
          />
          {gitHandlerEnabled && (
            <div className="pl-6 space-y-2">
              <Label className="text-xs font-medium">Git Committer</Label>
              <RadioGroup
                value={gitCommitterType}
                onValueChange={(value) => handleSetGitCommitterType(value as "kodu" | "user")}
                className="flex flex-col space-y-1">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="kodu" id="kodu" />
                  <Label htmlFor="kodu" className="text-sm">
                    Kodu AI
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="user" id="user" />
                  <Label htmlFor="user" className="text-sm">
                    User Profile
                  </Label>
                </div>
              </RadioGroup>
              <p className="text-[10px] text-muted-foreground">
                Choose who should be credited for git commits
              </p>
            </div>
          )}

          <ExperimentalFeatureItem
            feature={{
              id: "alwaysAllowReadOnly",
              label: "Always Allow Read-Only Operations",
              description: "Automatically read files and view directories without requiring permission",
            }}
            checked={readOnly}
            onCheckedChange={handleSetReadOnly}
          />

          <ExperimentalFeatureItem
            feature={{
              id: "autoCloseTerminal",
              label: "Automatically close terminal",
              description: "Automatically close the terminal after executing a command",
            }}
            checked={autoCloseTerminal}
            onCheckedChange={handleSetAutoCloseTerminal}
          />

          <div className="space-y-4">
            <ExperimentalFeatureItem
              feature={{
                id: "terminalCompressionThreshold",
                label: "Enable Terminal Compression",
                description:
                  "Compress terminal output to reduce token usage when the output exceeds the threshold at the end of context window",
              }}
              checked={terminalCompressionThreshold !== undefined}
              onCheckedChange={(checked) =>
                handleTerminalCompressionThresholdChange(checked ? 10000 : undefined)
              }
            />
            {terminalCompressionThreshold !== undefined && (
              <div className="pl-0 grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="range">Compression Threshold</Label>
                  <div className="grid gap-4">
                    <div className="flex items-center gap-4">
                      <Input
                        id="range"
                        type="number"
                        value={terminalCompressionThreshold}
                        onChange={(e) => {
                          const value = parseInt(e.target.value)
                          if (!isNaN(value)) {
                            handleTerminalCompressionThresholdChange(
                              Math.min(Math.max(value, 2000), 200000)
                            )
                          }
                        }}
                        min={2000}
                        max={200000}
                        step={1000}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">(2,000 - 200,000)</span>
                    </div>
                    <Slider
                      min={2000}
                      max={200000}
                      step={1000}
                      value={[terminalCompressionThreshold]}
                      onValueChange={(value) => handleTerminalCompressionThresholdChange(value[0])}
                      className="w-full"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Adjust the token threshold at which terminal output will be compressed
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="command-timeout">Command Timeout</Label>
              <div className="grid gap-4">
                <div className="flex items-center gap-4">
                  <Input
                    id="command-timeout"
                    type="number"
                    value={commandTimeout ?? 120}
                    onChange={(e) => {
                      const value = parseInt(e.target.value)
                      if (!isNaN(value)) {
                        handleCommandTimeout(value)
                      }
                    }}
                    min={60}
                    max={600}
                    step={10}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">(60 - 600)</span>
                </div>
                <Slider
                  min={60}
                  max={600}
                  step={10}
                  value={[commandTimeout ?? 120]}
                  onValueChange={(value) => handleCommandTimeout(value[0])}
                  className="w-full"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Set the maximum time in seconds that a command can run before being terminated
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="custom-instructions" className="text-xs font-medium">
                Custom Instructions
              </Label>
              <Textarea
                id="custom-instructions"
                placeholder="e.g. 'Run unit tests at the end', 'Use TypeScript with async/await'"
                value={customInstructions}
                onChange={handleTextAreaChange}
                className="min-h-[120px] text-xs resize-y"
                style={{
                  fontFamily: "var(--vscode-editor-font-family)",
                }}
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground mt-1">
                These instructions will be included in every task
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdvancedTab
