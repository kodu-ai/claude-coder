import React, { useState } from 'react'
import { File } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

export interface FileInfo {
  path: string
  content: string
}

interface FileBadgesProps {
  files?: FileInfo[]
}

export function FileBadges({ files = [] }: FileBadgesProps) {
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null)

  if (!files || files.length === 0) {
    return (
      <div className="p-4 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-lg shadow-md max-w-md mx-auto">
        <p className="text-gray-600">No files attached.</p>
      </div>
    )
  }

  return (
    <div className="p-4 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-lg shadow-md max-w-md mx-auto">
      <h2 className="text-lg font-semibold text-gray-800 mb-2">Attached Files</h2>
      <div className="flex flex-wrap gap-2">
        {files.map((file, index) => (
          <Dialog key={index}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                className="bg-white hover:bg-gray-100"
                onClick={() => setSelectedFile(file)}
              >
                <File className="w-4 h-4 mr-2" />
                <span className="truncate max-w-[140px] sm:max-w-[180px]">
                  {file.path}
                </span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{file.path}</DialogTitle>
              </DialogHeader>
              <ScrollArea className="mt-2 border rounded p-4 h-[300px]">
                <pre className="text-sm whitespace-pre-wrap">{file.content}</pre>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        ))}
      </div>
      <p className="mt-2 text-sm text-gray-600">
        Total files: {files.length}
      </p>
    </div>
  )
}