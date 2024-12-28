import React, { createContext, useContext, useState, useCallback } from 'react';
import { V1ClaudeMessage } from '../../../src/shared/messages/extension-message';

interface CollapseContextType {
  collapsedMessages: Set<string>;
  toggleCollapse: (messageTs: string) => void;
  isCollapsed: (messageTs: string) => boolean;
  shouldShowMessage: (message: V1ClaudeMessage, messages: V1ClaudeMessage[]) => boolean;
}

const CollapseContext = createContext<CollapseContextType | undefined>(undefined);

export function CollapseProvider({ children }: { children: React.ReactNode }) {
  const [collapsedMessages, setCollapsedMessages] = useState<Set<string>>(new Set());

  const toggleCollapse = useCallback((messageTs: string) => {
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

  const isCollapsed = useCallback((messageTs: string) => {
    return collapsedMessages.has(messageTs);
  }, [collapsedMessages]);

  const shouldShowMessage = useCallback((message: V1ClaudeMessage, messages: V1ClaudeMessage[]) => {
    // Always show API request messages
    if (message.say === 'api_req_started') {
      return true;
    }

    // Find the previous API request message
    const messageIndex = messages.findIndex(m => m.ts === message.ts);
    const previousMessages = messages.slice(0, messageIndex).reverse();
    const previousApiRequest = previousMessages.find(m => m.say === 'api_req_started');

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