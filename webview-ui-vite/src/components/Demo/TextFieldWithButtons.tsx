import React from 'react';
import {
  VSCodeTextField,
  VSCodeButton,
} from "@vscode/webview-ui-toolkit/react";

const TextFieldWithButtons: React.FC = () => (
  <VSCodeTextField>
    <section slot="end" style={{ display: "flex", alignItems: "center" }}>
      <VSCodeButton appearance="icon" aria-label="Match Case">
        <span className="codicon codicon-case-sensitive"></span>
      </VSCodeButton>
      <VSCodeButton appearance="icon" aria-label="Match Whole Word">
        <span className="codicon codicon-whole-word"></span>
      </VSCodeButton>
      <VSCodeButton appearance="icon" aria-label="Use Regular Expression">
        <span className="codicon codicon-regex"></span>
      </VSCodeButton>
    </section>
  </VSCodeTextField>
);

export default TextFieldWithButtons;