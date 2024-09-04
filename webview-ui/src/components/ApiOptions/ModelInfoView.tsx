import React from 'react';
import { ModelInfo } from "../../../../src/shared/api";
import { formatPrice } from './utils';

interface ModelInfoViewProps {
  modelInfo: ModelInfo;
}

const ModelInfoView: React.FC<ModelInfoViewProps> = ({ modelInfo }) => {
  return (
    <div style={{ fontSize: "12px", marginTop: "2px", color: "var(--vscode-descriptionForeground)" }}>
      <ModelInfoSupportsItem
        isSupported={modelInfo.supportsImages}
        supportsLabel="Supports images"
        doesNotSupportLabel="Does not support images"
      />
      <br />
      <ModelInfoSupportsItem
        isSupported={modelInfo.supportsPromptCache}
        supportsLabel="Supports prompt caching"
        doesNotSupportLabel="Does not support prompt caching"
      />
      <br />
      <span style={{ fontWeight: 500 }}>Max output:</span> {modelInfo?.maxTokens?.toLocaleString()} tokens
      <br />
      <span style={{ fontWeight: 500 }}>Input price:</span> {formatPrice(modelInfo.inputPrice)}/million tokens
      {modelInfo.supportsPromptCache && modelInfo.cacheWritesPrice && modelInfo.cacheReadsPrice && (
        <>
          <br />
          <span style={{ fontWeight: 500 }}>Cache writes price:</span>{" "}
          {formatPrice(modelInfo.cacheWritesPrice || 0)}/million tokens
          <br />
          <span style={{ fontWeight: 500 }}>Cache reads price:</span>{" "}
          {formatPrice(modelInfo.cacheReadsPrice || 0)}/million tokens
        </>
      )}
      <br />
      <span style={{ fontWeight: 500 }}>Output price:</span> {formatPrice(modelInfo.outputPrice)}/million tokens
    </div>
  );
};

interface ModelInfoSupportsItemProps {
  isSupported: boolean;
  supportsLabel: string;
  doesNotSupportLabel: string;
}

const ModelInfoSupportsItem: React.FC<ModelInfoSupportsItemProps> = ({
  isSupported,
  supportsLabel,
  doesNotSupportLabel,
}) => (
  <span
    style={{
      fontWeight: 500,
      color: isSupported ? "var(--vscode-terminal-ansiGreen)" : "var(--vscode-errorForeground)",
    }}
  >
    <i
      className={`codicon codicon-${isSupported ? "check" : "x"}`}
      style={{
        marginRight: 4,
        marginBottom: isSupported ? 1 : -1,
        fontSize: isSupported ? 11 : 13,
        fontWeight: 700,
        display: "inline-block",
        verticalAlign: "bottom",
      }}
    ></i>
    {isSupported ? supportsLabel : doesNotSupportLabel}
  </span>
);

export default ModelInfoView;