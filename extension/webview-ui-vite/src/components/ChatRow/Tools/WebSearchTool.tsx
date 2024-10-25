import { ScrollArea } from '@/components/ui/scroll-area'
import { AlertCircle, Globe, Search } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { WebSearchTool } from '../../../../../src/shared/new-tools'
import { ToolBlock, ToolStatus } from '../ToolRenderV1'

type EnhancedWebSearchBlockProps = WebSearchTool & {
  approvalState?: ToolStatus
  onApprove?: () => void
  onReject?: () => void
  ts: number
}

export const EnhancedWebSearchBlock: React.FC<EnhancedWebSearchBlockProps> = ({
  searchQuery,
  baseLink,
  content,
  streamType,
  approvalState,
  onApprove,
  onReject,
  ts,
}) => {
  const [currentStep, setCurrentStep] = useState('Initializing request')
  const [searchContent, setSearchContent] = useState('')

  useEffect(() => {
    if (approvalState === 'loading') {
      const steps = [
        'Setting up the stream',
        'Analyzing query',
        'Fetching results',
        'Summarizing findings'
      ]
      let currentStepIndex = 0

      const interval = setInterval(() => {
        setCurrentStep(steps[currentStepIndex])
        currentStepIndex = (currentStepIndex + 1) % steps.length
      }, 2000)

      return () => clearInterval(interval)
    }
  }, [approvalState])

  useEffect(() => {
    if (content) {
      setSearchContent(content)
    }
  }, [content])

  const renderContent = () => {
    if (approvalState === 'loading') {
      return (
        <div className="flex items-center space-x-2 text-primary animate-pulse">
          <Search className="w-4 h-4" />
          <span className="text-sm">{currentStep}</span>
        </div>
      )
    }

    if ((approvalState === 'approved' || approvalState === 'loading') && searchContent) {
      return (
        <ScrollArea className="h-[200px] w-full rounded-md border mt-2">
          <div className="p-4">
            <h4 className="text-sm font-semibold mb-2">Search Results:</h4>
            <pre className="text-sm whitespace-pre-wrap">{searchContent}</pre>
          </div>
        </ScrollArea>
      )
    }

    return null
  }

  return (
    <ToolBlock
      tool="web_search"
      icon={Globe}
      title={approvalState === 'loading' ? `Web Search - ${currentStep}` : 'Web Search'}
      variant={approvalState === 'approved' ? 'success' : 'info'}
      approvalState={approvalState}
      onApprove={onApprove}
      onReject={onReject}
      ts={ts}
    >
      <div className="space-y-2 text-sm">
        <p><span className="font-semibold">Search query:</span> {searchQuery}</p>
        {baseLink && <p><span className="font-semibold">Starting from:</span> {baseLink}</p>}
      </div>
      {renderContent()}
      {approvalState === 'approved' && searchContent && (
        <div className="mt-2 text-sm text-success">Search completed successfully.</div>
      )}
      {approvalState === 'error' && (
        <div className="mt-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 inline-block mr-1" />
          An error occurred during the search.
        </div>
      )}
    </ToolBlock>
  )
}