import React, { useEffect } from "react";
import { vscode } from "../../utils/vscode";
import { useExtensionState } from "../../context/ExtensionStateContext";
import AbortButton from "./AbortButton";

interface AbortAutomodeProps {
  isVisible: boolean;
}

const AbortAutomode: React.FC<AbortAutomodeProps> = ({ isVisible }) => {
  const [isAborting, setIsAborting] = React.useState(false);
  const { claudeMessages: messages } = useExtensionState();

  const lastMessage = messages[messages.length - 1];

  const handleAbort = () => {
    setIsAborting(true);
    vscode.postMessage({ type: "abortAutomode" });
  };

  useEffect(() => {
    if (lastMessage.say === "abort_automode") {
      setIsAborting(false);
    }
  }, [lastMessage]);

  return (
    <div style={{ display: "flex", padding: "10px 15px 0px 15px" }}>
      <AbortButton
        isDisabled={!isVisible || isAborting}
        isAborting={isAborting}
        onClick={handleAbort}
      />
    </div>
  );
};

export default AbortAutomode;