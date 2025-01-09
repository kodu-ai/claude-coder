"use client"

import React, { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import UserInfoSection from "./user-info-section"
import ExperimentalTab from "./experimental-tab"
import AdvancedTab from "./advanced-tab"
import AgentsTab from "./agents-tab"
import ClosePageButton from "./close-page-button"
import { SettingsFooter } from "./settings-footer"
import { Label } from "../ui/label"
import { Separator } from "../ui/separator"
import PreferencesTabNew from "./preferences/preferences-tab"

const tabItems = [
	{ value: "preferences", label: "Preferences" },
	{ value: "experimental", label: "Experimental" },
	{ value: "advanced", label: "Advanced" },
	{ value: "agents", label: "Agents" },
]

const SettingsPage: React.FC = () => {
	const [activeTab, setActiveTab] = useState("preferences")
	const [isMobile, setIsMobile] = useState(false)

	useEffect(() => {
		const checkMobile = () => setIsMobile(window.innerWidth < 315)
		checkMobile()
		window.addEventListener("resize", checkMobile)
		return () => window.removeEventListener("resize", checkMobile)
	}, [])

	const handleTabChange = (value: string) => {
		setActiveTab(value)
	}

	return (
		<div className="container mx-auto px-4 max-[280px]:px-2 py-4 max-w-[500px] flex flex-col h-full">
			<div className="flex items-center justify-between">
				<h1 className="text-xl font-bold mb-2">Settings</h1>
				<ClosePageButton />
			</div>
			<p className="text-xs text-muted-foreground mb-4">Manage your extension preferences</p>

			<div className="mb-4 space-y-3">
				<UserInfoSection />
			</div>

			{isMobile ? (
				<div>
					<Label>Settings</Label>
					<Select value={activeTab} onValueChange={handleTabChange}>
						<SelectTrigger className="w-full mb-2.5 mt-1">
							<SelectValue placeholder="Select a tab" />
						</SelectTrigger>
						<SelectContent>
							{tabItems.map((item) => (
								<SelectItem key={item.value} value={item.value}>
									{item.label} Tab
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Separator />
				</div>
			) : (
				<Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4 mx-auto">
					<TabsList>
						{tabItems.map((item) => (
							<TabsTrigger className="p-1.5 text-xs" key={item.value} value={item.value}>
								{item.label}
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
			)}

			<div className="mt-4">
				{activeTab === "preferences" && <PreferencesTabNew />}
				{activeTab === "experimental" && <ExperimentalTab />}
				{activeTab === "advanced" && <AdvancedTab />}
				{activeTab === "agents" && <AgentsTab />}
			</div>

			<div className="mt-auto mb-2 flex w-full">
				<SettingsFooter />
			</div>
		</div>
	)
}

export default SettingsPage
