import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'

export interface FileItem {
  name: string
  content: string
}

const getFileExtension = (filename: string): string => {
  const parts = filename.split('.')
  return parts[parts.length - 1]
}

const getLanguageIcon = (filename: string): string => {
  const extension = getFileExtension(filename)
  // This function would return the appropriate icon based on file extension
  // For simplicity, we're using a placeholder. In a real implementation,
  // you'd import icons or use a library like 'vscode-icons'
  return extension.toUpperCase()
}

// Sample files for testing
const sampleFiles: FileItem[] = [
  { name: 'README.md', content: '# Project Title\n\nThis is a sample README file.' },
  { name: 'App.tsx', content: 'export default function App() {\n  return <div>Hello World</div>\n}' },
  { name: 'styles.css', content: 'body {\n  font-family: sans-serif;\n}' },
  { name: 'api.js', content: 'const api = {\n  getUser: () => fetch("/user")\n}' },
  { name: 'config.json', content: '{\n  "apiUrl": "https://api.example.com"\n}' },
  { name: 'index.html', content: '<html><body><h1>Welcome</h1></body></html>' },
  { name: 'database.sql', content: 'CREATE TABLE users (id INT, name VARCHAR(255));' },
  { name: 'requirements.txt', content: 'react\nreact-dom\ntailwindcss' },
  { name: 'Dockerfile', content: 'FROM node:14\nWORKDIR /app\nCOPY . .\nRUN npm install' },
  { name: '.gitignore', content: 'node_modules\n.env\n.DS_Store' },
]

export default function FileList({ files }: { files?: FileItem[] }) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!files || files.length === 0) {
    return <div className="text-white text-sm">No files to display</div>
  }

  const visibleFiles = isExpanded ? files : files.slice(0, 4)
  const hiddenCount = files.length - visibleFiles.length

  const toggleExpand = () => {
    setIsExpanded(!isExpanded)
  }
	// TODO: Replace the content with native VSCOde open a new file with "name" and "content" properly
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1 items-center">
        {visibleFiles.map((file, index) => (
          <Dialog key={index}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                className="bg-gray-700 text-white hover:bg-gray-600 transition-colors h-6 px-2 py-0 text-xs"
              >
                <span className="font-mono mr-1">{getLanguageIcon(file.name)}</span>
                <span className="truncate max-w-[80px]">{file.name}</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{file.name}</DialogTitle>
              </DialogHeader>
              <ScrollArea className="mt-2 border rounded p-4">	
              {file.content}
              </ScrollArea>
            </DialogContent>
          </Dialog>
        ))}
        {files.length > 4 && (
          <Button
            variant="outline"
            onClick={toggleExpand}
            className="bg-gray-600 text-white hover:bg-gray-500 transition-colors h-6 px-2 py-0 text-xs"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3 h-3 mr-1" />
                <span>Less</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3 mr-1" />
                <span>+{hiddenCount}</span>
              </>
            )}
          </Button>
        )}
      </div>
      <div className="text-gray-400 text-xs">
        {files.length} file{files.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}