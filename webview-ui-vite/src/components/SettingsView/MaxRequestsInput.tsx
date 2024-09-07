import React from 'react';
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react";

interface MaxRequestsInputProps {
  value: string;
  onChange: (value: string) => void;
  errorMessage?: string;
}

const MaxRequestsInput: React.FC<MaxRequestsInputProps> = ({ value, onChange, errorMessage }) => (
  <div style={{ marginBottom: 5 }}>
    <VSCodeTextField
      value={value}
      style={{ width: "100%" }}
      placeholder="20"
      onInput={(e: any) => onChange(e.target?.value ?? "")}
    >
      <span style={{ fontWeight: "500" }}>Maximum # Requests Per Task</span>
    </VSCodeTextField>
    <p style={{
      fontSize: "12px",
      marginTop: "5px",
      color: "var(--vscode-descriptionForeground)",
    }}>
      If Claude Dev reaches this limit, it will pause and ask for your permission before making additional requests.
    </p>
    {errorMessage && (
      <p style={{
        fontSize: "12px",
        marginTop: "5px",
        color: "var(--vscode-errorForeground)",
      }}>
        {errorMessage}
      </p>
    )}
  </div>
);

export default MaxRequestsInput;