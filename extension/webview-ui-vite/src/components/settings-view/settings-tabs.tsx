import React from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import UserInfoSection from "./user-info-section"
import PreferencesTab from "./preferences-tab"
import ExperimentalTab from "./experimental-tab"
import AdvancedTab from "./advanced-tab"
import ClosePageButton from "./close-page-button"
import { SettingsFooter } from "./settings-footer"

const SettingsPage: React.FC = () => {
	return (
		<div className="container mx-auto px-4 max-[280px]:px-2 py-4 max-w-[500px] flex flex-col h-full">
			<div className="flex items-center">
				<h1 className="text-xl font-bold mb-2">Settings</h1>
				<ClosePageButton />
			</div>
			<p className="text-xs text-muted-foreground mb-4">Manage your extension preferences</p>

			<div className="mb-4 space-y-3">
				<UserInfoSection />
			</div>

			<Tabs defaultValue="preferences" className="space-y-4">
				<TabsList className="w-full grid grid-cols-3 gap-1 max-[280px]:grid-cols-1 h-fit">
					<TabsTrigger value="preferences" className="text-xs py-1 px-2 h-auto">
						Preferences
					</TabsTrigger>
					<TabsTrigger value="experimental" className="text-xs py-1 px-2 h-auto">
						Experimental
					</TabsTrigger>
					<TabsTrigger value="advanced" className="text-xs py-1 px-2 h-auto">
						Advanced
					</TabsTrigger>
				</TabsList>

				<TabsContent value="preferences">
					<PreferencesTab />
				</TabsContent>

				<TabsContent value="experimental">
					<ExperimentalTab />
				</TabsContent>

				<TabsContent value="advanced">
					<AdvancedTab />
				</TabsContent>
			</Tabs>

			<div className="mt-auto mb-2 flex w-full">
				<SettingsFooter />
			</div>
		</div>
	)
}

export default SettingsPage
