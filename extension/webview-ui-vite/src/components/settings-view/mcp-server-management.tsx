import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Settings2, Plus, Trash2 } from "lucide-react"
import { useSettingsState } from "../../hooks/use-settings-state"
import { IconButton } from "../ui/icon-button"
import { vscode } from "@/utils/vscode"

export const McpServerManagement: React.FC = () => {
  const { mcpServers = {} } = useSettingsState()

  const handleAddServer = () => {
    vscode.postMessage({ type: "addMcpServer" })
  }

  const handleConfigureServer = (serverName: string) => {
    vscode.postMessage({ 
      type: "configureMcpServer",
      serverName
    })
  }

  const handleRemoveServer = (serverName: string) => {
    vscode.postMessage({ 
      type: "removeMcpServer",
      serverName
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex justify-between items-center">
          MCP Servers
          <IconButton onClick={handleAddServer}>
            <Plus className="h-4 w-4" />
          </IconButton>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Object.entries(mcpServers).length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4">
              No MCP servers configured
            </div>
          ) : (
            Object.entries(mcpServers).map(([name, server]) => (
              <div key={name} className="flex items-center justify-between gap-2 p-2 bg-secondary/50 rounded-md">
                <div className="flex-1">
                  <Label className="text-sm font-medium">{name}</Label>
                  <p className="text-xs text-muted-foreground truncate">
                    {server.command} {server.args?.join(" ")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <IconButton onClick={() => handleConfigureServer(name)}>
                    <Settings2 className="h-4 w-4" />
                  </IconButton>
                  <IconButton variant="destructive" onClick={() => handleRemoveServer(name)}>
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}