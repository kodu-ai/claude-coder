import React, { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { rpcClient } from "@/lib/rpc-client"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { vscode } from "@/utils/vscode"

type ToolParserDialect = "xml" | "json" | "anthropic-json"

interface DialectSelectorProps {
	modelId: string | undefined
}

export const DialectSelector: React.FC<DialectSelectorProps> = ({ modelId }) => {
	const [dialect, setDialect] = useState<ToolParserDialect>("xml")

	// Fetch initial dialect configuration
	const { data: toolParserDialect } = rpcClient.getGlobalState.useQuery(
		{ key: "toolParserDialect" },
		{
			refetchOnWindowFocus: false,
		}
	)

	useEffect(() => {
		if (toolParserDialect) {
			setDialect(toolParserDialect as ToolParserDialect)
		} else {
			// Set default to xml if not configured
			handleDialectChange("xml")
		}
	}, [toolParserDialect])

	const { mutate: updateGlobalState } = rpcClient.updateGlobalState.useMutation({
		onSuccess: () => {
			console.log("Tool parser dialect updated successfully")
		},
		onError: (error) => {
			console.error("Error updating tool parser dialect:", error)
		},
	})

	const handleDialectChange = (newDialect: ToolParserDialect) => {
		updateGlobalState({
			key: "toolParserDialect",
			value: newDialect,
		})
		setDialect(newDialect)

		// Send a message to the extension to update the dialect
		vscode.postMessage({
			type: "setToolParserDialect",
			dialect: newDialect,
		})
	}

	return (
		<Card className="mt-4">
			<CardHeader>
				<CardTitle className="text-base">Tool Parser Configuration</CardTitle>
				<CardDescription className="text-sm">
					Configure the dialect used for parsing tool commands
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-6">
				<div className="space-y-4">
					<RadioGroup
						value={dialect}
						onValueChange={(value) => handleDialectChange(value as ToolParserDialect)}>
						<div className="flex items-start space-x-2 mb-2">
							<RadioGroupItem value="xml" id="dialect-xml" />
							<div className="grid gap-1.5">
								<Label htmlFor="dialect-xml" className="font-medium">
									XML (Default)
								</Label>
								<p className="text-sm text-muted-foreground">
									Standard XML-based tool parsing syntax with tag-based format
								</p>
							</div>
						</div>

						<div className="flex items-start space-x-2 mb-2">
							<RadioGroupItem value="json" id="dialect-json" />
							<div className="grid gap-1.5">
								<Label htmlFor="dialect-json" className="font-medium">
									JSON
								</Label>
								<p className="text-sm text-muted-foreground">
									JSON-based tool parsing syntax with structured format
								</p>
							</div>
						</div>

						<div className="flex items-start space-x-2">
							<RadioGroupItem
								value="anthropic-json"
								id="dialect-anthropic-json"
								disabled={modelId !== "claude-3-7-sonnet-20250219"}
							/>
							<div className="grid gap-1.5">
								<Label
									htmlFor="dialect-anthropic-json"
									className={`font-medium ${
										modelId !== "claude-3-7-sonnet-20250219" ? "text-muted-foreground" : ""
									}`}>
									Anthropic JSON
								</Label>
								<p className="text-sm text-muted-foreground">
									Native Anthropic tool calling format with extended thinking (Claude 3.7 Sonnet only)
								</p>
							</div>
						</div>
					</RadioGroup>
				</div>
			</CardContent>
		</Card>
	)
}
