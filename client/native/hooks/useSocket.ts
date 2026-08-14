import { useCallback, useEffect, useRef } from 'react';

import type { SocketClient } from '@/lib/api/socket';

/**
 * Generic socket lifecycle hook. Ported from the web client's
 * `hooks/useSocket.ts` (`window.setTimeout` → `setTimeout` for React Native).
 */

type UseSocketOptions<TEvent, TOutgoing> = {
  enabled?: boolean;
  createClient: () => SocketClient<TEvent, TOutgoing>;
  onEvent: (event: TEvent) => void;
  onDispose?: () => void;
};

export function useSocket<TEvent, TOutgoing>({
  enabled = true,
  createClient,
  onEvent,
  onDispose,
}: UseSocketOptions<TEvent, TOutgoing>) {
  const eventHandlerRef = useRef(onEvent);
  const clientRef = useRef<SocketClient<TEvent, TOutgoing> | null>(null);

  useEffect(() => {
    eventHandlerRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled) {
      clientRef.current = null;
      onDispose?.();
      return;
    }

    let disposed = false;
    let disconnect: () => void = () => undefined;
    const connectTimer = setTimeout(() => {
      if (disposed) {
        return;
      }

      const client = createClient();
      clientRef.current = client;

      disconnect = client.connect((event) => {
        eventHandlerRef.current(event);
      });
    }, 0);

    return () => {
      disposed = true;
      clearTimeout(connectTimer);
      clientRef.current = null;
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createClient, enabled]);

  const send = useCallback((payload: TOutgoing) => {
    return clientRef.current?.send(payload) ?? false;
  }, []);

  return { send };
}
