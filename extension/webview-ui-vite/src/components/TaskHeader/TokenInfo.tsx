import { ArrowRightCircle, DatabaseBackup, FileInput, FileOutput, FilePen, PlusCircle } from 'lucide-react'
import type React from 'react'

interface TokenInfoProps {
	tokensIn: number
	tokensOut: number
	doesModelSupportPromptCache: boolean
	cacheWrites?: number
	cacheReads?: number
	totalCost: number
}

const TokenInfo: React.FC<TokenInfoProps> = ({
	tokensIn,
	tokensOut,
	doesModelSupportPromptCache,
	cacheWrites,
	cacheReads,
	totalCost,
}) => {
	return (
		<div className="text-light flex-line wrap" style={{ justifyContent: 'space-between' }}>
			<div className="flex-line nowrap">
				Tokens:
				<code>
					<span>
						<FileInput size={12} className="mr-1" />
					</span>
					{tokensIn?.toLocaleString()}
				</code>
				<code>
					<span>
						<FilePen size={12} className="mr-1" />
					</span>
					{tokensOut?.toLocaleString()}
				</code>
			</div>
			{(doesModelSupportPromptCache || cacheReads !== undefined || cacheWrites !== undefined) && (
				<div className="flex-line nowrap">
					Cache:
					<code>
						<span>
							<PlusCircle size={12} className="mr-1" />
						</span>
						{(cacheWrites || 0)?.toLocaleString()}
					</code>
					<code>
						<span>
							<DatabaseBackup size={12} className="mr-1" />
						</span>
						{(cacheReads || 0)?.toLocaleString()}
					</code>
				</div>
			)}
			<div className="flex-line nowrap mt-1">
				API Cost:
				<code>
					<span>$</span>
					{totalCost?.toFixed(4)}
				</code>
			</div>
		</div>
	)
}

export default TokenInfo
