import React, { useState } from "react";
import Tooltip, { TooltipProps } from "./Tooltip";
import NavButton from "./NavButton";

export const TAB_NAVBAR_HEIGHT = 24;
const BUTTON_MARGIN_RIGHT = "3px";
const LAST_BUTTON_MARGIN_RIGHT = "13px";

interface TabNavbarProps {
  onPlusClick: () => void;
  onHistoryClick: () => void;
  onSettingsClick: () => void;
}

const TabNavbar: React.FC<TabNavbarProps> = ({ onPlusClick, onHistoryClick, onSettingsClick }) => {
  const [tooltip, setTooltip] = useState<TooltipProps>({
    text: "",
    isVisible: false,
    position: { x: 0, y: 0 },
    align: "center",
  });

  const showTooltip = (text: string, event: React.MouseEvent, align: "left" | "center" | "right" = "center") => {
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltip({
      text,
      isVisible: true,
      position: { x: rect.left + rect.width / 2, y: rect.bottom + 7 },
      align,
    });
  };

  const hideTooltip = () => {
    setTooltip((prev) => ({ ...prev, isVisible: false }));
  };

  const buttonStyle = {
    marginRight: BUTTON_MARGIN_RIGHT,
  };

  const lastButtonStyle = {
    ...buttonStyle,
    marginRight: LAST_BUTTON_MARGIN_RIGHT,
  };

  return (
    <>
      <div
        style={{
          position: "absolute",
          top: 4,
          right: 0,
          left: 0,
          height: TAB_NAVBAR_HEIGHT,
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
        }}
      >
        <NavButton
          onClick={onPlusClick}
          icon="add"
          tooltip="New Chat"
          style={buttonStyle}
          onShowTooltip={showTooltip}
          onHideTooltip={hideTooltip}
        />
        <NavButton
          onClick={onHistoryClick}
          icon="history"
          tooltip="History"
          style={buttonStyle}
          onShowTooltip={showTooltip}
          onHideTooltip={hideTooltip}
        />
        <NavButton
          onClick={onSettingsClick}
          icon="settings-gear"
          tooltip="Settings"
          style={lastButtonStyle}
          onShowTooltip={showTooltip}
          onHideTooltip={hideTooltip}
          tooltipAlign="right"
        />
      </div>
      <Tooltip {...tooltip} />
    </>
  );
};

export default TabNavbar;