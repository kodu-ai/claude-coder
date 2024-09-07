import React from 'react';

interface TokenInfoProps {
  tokensIn: number;
  tokensOut: number;
  doesModelSupportPromptCache: boolean;
  cacheWrites?: number;
  cacheReads?: number;
  totalCost: number;
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
    <div className="text-light flex-line wrap" style={{ justifyContent: "space-between" }}>
      <div className="flex-line nowrap">
        Tokens:
        <code>
          <span>↑</span>
          {tokensIn?.toLocaleString()}
        </code>
        <code>
          <span>↓</span>
          {tokensOut?.toLocaleString()}
        </code>
      </div>
      {(doesModelSupportPromptCache || cacheReads !== undefined || cacheWrites !== undefined) && (
        <div className="flex-line nowrap">
          Cache:
          <code>
            <span>+</span>
            {(cacheWrites || 0)?.toLocaleString()}
          </code>
          <code>
            <span>→</span>
            {(cacheReads || 0)?.toLocaleString()}
          </code>
        </div>
      )}
      <div className="flex-line nowrap">
        API Cost:
        <code>
          <span>$</span>
          {totalCost?.toFixed(4)}
        </code>
      </div>
    </div>
  );
};

export default TokenInfo;