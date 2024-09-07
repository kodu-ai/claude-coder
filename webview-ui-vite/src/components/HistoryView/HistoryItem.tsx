import React from 'react';
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import { formatDate, highlightText } from './utils';

interface HistoryItemProps {
  item: any;
  index: number;
  totalItems: number;
  searchQuery: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string) => void;
}

const HistoryItem: React.FC<HistoryItemProps> = ({
  item,
  index,
  totalItems,
  searchQuery,
  onSelect,
  onDelete,
  onExport,
}) => (
  <div
    className="history-item"
    style={{
      cursor: "pointer",
      borderBottom: index < totalItems - 1 ? "1px solid var(--vscode-panel-border)" : "none",
    }}
    onClick={() => onSelect(item.id)}
  >
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        padding: "12px 20px",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span
          style={{
            color: "var(--vscode-descriptionForeground)",
            fontWeight: 500,
            fontSize: "0.85em",
            textTransform: "uppercase",
          }}
        >
          {formatDate(item.ts)}
        </span>
        <VSCodeButton
          appearance="icon"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item.id);
          }}
          className="delete-button"
        >
          <span className="codicon codicon-trash"></span>
        </VSCodeButton>
      </div>
      <div
        style={{
          fontSize: "var(--vscode-font-size)",
          color: "var(--vscode-foreground)",
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          overflowWrap: "anywhere",
        }}
      >
        {highlightText(item.task, searchQuery)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <TokenInfo tokensIn={item.tokensIn} tokensOut={item.tokensOut} />
        {item.cacheWrites && item.cacheReads && (
          <CacheInfo cacheWrites={item.cacheWrites} cacheReads={item.cacheReads} />
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: -2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <code>API Cost:</code>
            <span style={{ color: "var(--vscode-descriptionForeground)" }}>
              ${item.totalCost?.toFixed(4)}
            </span>
          </div>
          <VSCodeButton
            appearance="icon"
            onClick={(e) => {
              e.stopPropagation();
              onExport(item.id);
            }}
          >
            <div style={{ fontSize: "11px", fontWeight: 500, opacity: 1 }}>EXPORT .MD</div>
          </VSCodeButton>
        </div>
      </div>
    </div>
  </div>
);

const TokenInfo: React.FC<{ tokensIn: number; tokensOut: number }> = ({ tokensIn, tokensOut }) => (
  <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
    <span style={{ fontWeight: 500, color: "var(--vscode-descriptionForeground)" }}>Tokens:</span>
    <span style={{ display: "flex", alignItems: "center", gap: "3px", color: "var(--vscode-descriptionForeground)" }}>
      <i className="codicon codicon-arrow-up" style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "-2px" }} />
      {tokensIn?.toLocaleString()}
    </span>
    <span style={{ display: "flex", alignItems: "center", gap: "3px", color: "var(--vscode-descriptionForeground)" }}>
      <i className="codicon codicon-arrow-down" style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "-2px" }} />
      {tokensOut?.toLocaleString()}
    </span>
  </div>
);

const CacheInfo: React.FC<{ cacheWrites: number; cacheReads: number }> = ({ cacheWrites, cacheReads }) => (
  <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
    <span style={{ fontWeight: 500, color: "var(--vscode-descriptionForeground)" }}>Cache:</span>
    <span style={{ display: "flex", alignItems: "center", gap: "3px", color: "var(--vscode-descriptionForeground)" }}>
      <i className="codicon codicon-database" style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "-1px" }} />
      +{cacheWrites?.toLocaleString()}
    </span>
    <span style={{ display: "flex", alignItems: "center", gap: "3px", color: "var(--vscode-descriptionForeground)" }}>
      <i className="codicon codicon-arrow-right" style={{ fontSize: "12px", fontWeight: "bold", marginBottom: 0 }} />
      {cacheReads?.toLocaleString()}
    </span>
  </div>
);

export default HistoryItem;