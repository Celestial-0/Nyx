export type SocketListener<TEvent> = (event: TEvent) => void

export type SocketClient<TEvent, TOutgoing = unknown> = {
  connect: (listener: SocketListener<TEvent>) => () => void
  send: (payload: TOutgoing) => boolean
}

type WebSocketStatus = "connecting" | "connected" | "disconnected" | "error"

type CreateWebSocketClientOptions<TEvent> = {
  url: string
  parseMessage: (rawMessage: string) => TEvent | null
  onStatusChange?: (status: WebSocketStatus) => void
}

export function createWebSocketClient<TEvent, TOutgoing = unknown>({
  url,
  parseMessage,
  onStatusChange,
}: CreateWebSocketClientOptions<TEvent>): SocketClient<TEvent, TOutgoing> {
  let currentSocket: WebSocket | null = null

  return {
    connect: (listener) => {
      if (typeof window === "undefined") {
        return () => undefined
      }

      onStatusChange?.("connecting")
      const activeSocket = new window.WebSocket(url)
      currentSocket = activeSocket

      const handleOpen = () => {
        onStatusChange?.("connected")
      }

      const handleMessage = (event: MessageEvent) => {
        if (typeof event.data !== "string") {
          return
        }

        const parsed = parseMessage(event.data)
        if (parsed) {
          listener(parsed)
        }
      }

      const handleClose = () => {
        if (currentSocket === activeSocket) {
          currentSocket = null
        }
        onStatusChange?.("disconnected")
      }

      const handleError = () => {
        onStatusChange?.("error")
      }

      activeSocket.addEventListener("open", handleOpen)
      activeSocket.addEventListener("message", handleMessage)
      activeSocket.addEventListener("close", handleClose)
      activeSocket.addEventListener("error", handleError)

      return () => {
        activeSocket.removeEventListener("open", handleOpen)
        activeSocket.removeEventListener("message", handleMessage)
        activeSocket.removeEventListener("close", handleClose)
        activeSocket.removeEventListener("error", handleError)

        if (currentSocket === activeSocket) {
          currentSocket = null
        }

        if (
          activeSocket.readyState === WebSocket.OPEN ||
          activeSocket.readyState === WebSocket.CONNECTING
        ) {
          activeSocket.close()
        }
      }
    },

    send: (payload) => {
      if (!currentSocket || currentSocket.readyState !== WebSocket.OPEN) {
        return false
      }

      currentSocket.send(JSON.stringify(payload))
      return true
    },
  }
}
