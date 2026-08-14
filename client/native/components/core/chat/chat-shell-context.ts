import { createContext, useContext } from 'react';

import type { useChatShell } from '@/hooks/useChatShell';

export type ChatShell = ReturnType<typeof useChatShell>;

const ChatShellContext = createContext<ChatShell | null>(null);

export const ChatShellProvider = ChatShellContext.Provider;

/** Access the shared chat shell (handlers + derived state). */
export function useChatShellContext(): ChatShell {
  const context = useContext(ChatShellContext);
  if (!context) {
    throw new Error('useChatShellContext must be used within <ChatShellProvider>');
  }
  return context;
}
