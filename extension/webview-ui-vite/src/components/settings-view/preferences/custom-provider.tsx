import React, { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChevronRight, X } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

const CustomProvider = () => {
	const [isInvalid, setIsInvalid] = useState(false)
	const [route, setRoute] = useState("")
	const [headers, setHeaders] = useState('{\n  "Content-Type": "application/json"\n}')
	const [body, setBody] = useState('{\n  "model": "your-model",\n  "messages": []\n}')

	const formatJSON = (jsonString: string, setter: (value: string) => void) => {
		try {
			const parsed = JSON.parse(jsonString)
			setter(JSON.stringify(parsed, null, 2))
		} catch (e) {
			// Keep the invalid JSON as is while editing
		}
	}

	const saveProvider = () => {
		// first validate the route
		// then validate the headers
		// then validate the body
		// if all are valid, save the provider
		const isValidRoute = route.length > 0

		let isValidHeaders = false
		try {
			const parsed = JSON.parse(headers)
			isValidHeaders = true
		} catch (e) {
			isValidHeaders = false
		}
		let isValidBody = false
		try {
			const parsed = JSON.parse(body)
			isValidBody = true
		} catch (e) {
			isValidBody = false
		}
		if (isValidRoute && isValidHeaders && isValidBody) {
			console.log("Save Provider")
			setIsInvalid(false)
		} else {
			setIsInvalid(true)
		}
	}

	return (
		<Card className="w-full max-w-md bg-background border-border">
			<CardContent className="p-3 space-y-3">
				<div className="space-y-2">
					<Label htmlFor="route" className="text-sm text-foreground">
						Route
					</Label>
					<div className="flex gap-2">
						<Input
							id="route"
							placeholder="https://api.example.com/v1/chat/completions"
							value={route}
							onChange={(e) => setRoute(e.target.value)}
							className="text-sm h-8"
						/>
						<Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRoute("")}>
							<X className="h-4 w-4" />
						</Button>
					</div>
				</div>

				<Accordion type="multiple" className="w-full space-y-2">
					<AccordionItem value="headers" className="border rounded-md">
						<AccordionTrigger className="px-3 py-1 text-sm hover:no-underline">
							<div className="flex items-center gap-2">
								<ChevronRight className="h-4 w-4" />
								Headers
							</div>
						</AccordionTrigger>
						<AccordionContent className="px-3 pb-3">
							<ScrollArea className="h-32 rounded border border-input bg-background">
								<textarea
									rows={10}
									value={headers}
									onChange={(e) => setHeaders(e.target.value)}
									onBlur={() => formatJSON(headers, setHeaders)}
									className="min-h-full w-full resize-none bg-transparent p-2 text-sm font-mono leading-relaxed focus:outline-none"
									spellCheck={false}
								/>
							</ScrollArea>
						</AccordionContent>
					</AccordionItem>

					<AccordionItem value="body" className="border rounded-md">
						<AccordionTrigger className="px-3 py-1 text-sm hover:no-underline">
							<div className="flex items-center gap-2">
								<ChevronRight className="h-4 w-4" />
								Body
							</div>
						</AccordionTrigger>
						<AccordionContent className="px-3 pb-3">
							<ScrollArea className="h-48 rounded border border-input bg-background">
								<textarea
									rows={10}
									value={body}
									onChange={(e) => setBody(e.target.value)}
									onBlur={() => formatJSON(body, setBody)}
									className="min-h-full w-full resize-none bg-transparent p-2 text-sm font-mono leading-relaxed focus:outline-none"
									spellCheck={false}
								/>
							</ScrollArea>
						</AccordionContent>
					</AccordionItem>
				</Accordion>

				<Button onClick={saveProvider} className="w-full h-8 text-sm">
					Save Provider
				</Button>
				{isInvalid && (
					<Alert variant="destructive" className="text-sm">
						<AlertDescription>
							Invalid Provider. Please make sure the route, headers, and body are valid JSON and try
							again.
						</AlertDescription>
					</Alert>
				)}
			</CardContent>
		</Card>
	)
}

export default CustomProvider
