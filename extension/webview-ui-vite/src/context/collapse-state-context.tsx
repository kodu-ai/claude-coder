import React, { createContext, useContext, useState, useCallback } from 'react';
import { ClaudeMessage, isV1ClaudeMessage } from '../../../src/shared/messages/extension-message';

interface CollapseContextType {
  collapsedMessages: Set<number>;
  toggleCollapse: (messageTs: number) => void;
  isCollapsed: (messageTs: number) => boolean;
  shouldShowMessage: (message: ClaudeMessage, messages: ClaudeMessage[]) => boolean;
}

const CollapseContext = createContext<CollapseContextType | undefined>(undefined);

export function CollapseProvider({ children }: { children: React.ReactNode }) {
  const [collapsedMessages, setCollapsedMessages] = useState<Set<number>>(new Set());

  const toggleCollapse = useCallback((messageTs: number) => {
    setCollapsedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(messageTs)) {
        next.delete(messageTs);
      } else {
        next.add(messageTs);
      }
      return next;
    });
  }, []);

  const isCollapsed = useCallback((messageTs: number) => {
    return collapsedMessages.has(messageTs);
  }, [collapsedMessages]);

  const shouldShowMessage = useCallback((message: ClaudeMessage, messages: ClaudeMessage[]) => {
    // Only V1 messages can be collapsed
    if (!isV1ClaudeMessage(message)) {
      return true;
    }

    // Always show API request messages
    if (message.say === 'api_req_started') {
      return true;
    }

    // Find the previous API request message
    let previousApiRequest: ClaudeMessage | undefined;
    const messageIndex = messages.findIndex(m => m.ts === message.ts);
    
    // Iterate backwards from current message to find the previous API request
    for (let i = messageIndex - 1; i >= 0; i--) {
      const msg = messages[i];
      if (isV1ClaudeMessage(msg) && msg.say === 'api_req_started') {
        previousApiRequest = msg;
        break;
      }
    }

    // If there's no previous API request or it's not collapsed, show the message
    if (!previousApiRequest || !collapsedMessages.has(previousApiRequest.ts)) {
      return true;
    }

    // If the previous API request is collapsed, hide this message
    return false;
  }, [collapsedMessages]);

  const value = {
    collapsedMessages,
    toggleCollapse,
    isCollapsed,
    shouldShowMessage,
  };

  return <CollapseContext.Provider value={value}>{children}</CollapseContext.Provider>;
}

export function useCollapseState() {
  const context = useContext(CollapseContext);
  if (context === undefined) {
    throw new Error('useCollapseState must be used within a CollapseProvider');
  }
  return context;
}