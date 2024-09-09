import React from 'react';
import { VSCodeTextArea } from "@vscode/webview-ui-toolkit/react";

interface CustomInstructionsProps {
  value: string;
  onChange: (value: string) => void;
}

const CustomInstructions: React.FC<CustomInstructionsProps> = ({ value, onChange }) => (
  <div style={{ marginBottom: 5 }}>
    <VSCodeTextArea
      value={value}
      style={{ width: "100%" }}
      rows={4}
      placeholder={'e.g. "Run unit tests at the end", "Use TypeScript with async/await", "Speak in Spanish"'}
      onInput={(e: any) => onChange(e.target?.value ?? "")}
    >
      <span style={{ fontWeight: "500" }}>Custom Instructions</span>
    </VSCodeTextArea>
    <p style={{
      fontSize: "12px",
      marginTop: "5px",
      color: "var(--vscode-descriptionForeground)",
    }}>
      These instructions are added to the end of the system prompt sent with every request.
    </p>
  </div>
);

export default CustomInstructions;