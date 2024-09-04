import React from 'react';
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";

interface ButtonSectionProps {
  primaryButtonText: string | undefined;
  secondaryButtonText: string | undefined;
  enableButtons: boolean;
  handlePrimaryButtonClick: () => void;
  handleSecondaryButtonClick: () => void;
}

const ButtonSection: React.FC<ButtonSectionProps> = ({
  primaryButtonText,
  secondaryButtonText,
  enableButtons,
  handlePrimaryButtonClick,
  handleSecondaryButtonClick,
}) => {
  return (
    <div
      style={{
        opacity: primaryButtonText || secondaryButtonText ? (enableButtons ? 1 : 0.5) : 0,
        display: "flex",
        padding: "8px 16px 0px 15px",
      }}
    >
      {primaryButtonText && (
        <VSCodeButton
          appearance="primary"
          disabled={!enableButtons}
          style={{
            flex: secondaryButtonText ? 1 : 2,
            marginRight: secondaryButtonText ? "6px" : "0",
          }}
          onClick={handlePrimaryButtonClick}
        >
          {primaryButtonText}
        </VSCodeButton>
      )}
      {secondaryButtonText && (
        <VSCodeButton
          appearance="secondary"
          disabled={!enableButtons}
          style={{ flex: 1, marginLeft: "6px" }}
          onClick={handleSecondaryButtonClick}
        >
          {secondaryButtonText}
        </VSCodeButton>
      )}
    </div>
  );
};

export default ButtonSection;