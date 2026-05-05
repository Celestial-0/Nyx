export const authEventTopics = {
  sessionCreated: "auth:session:created",
  sessionTerminated: "auth:session:terminated",
  profileCompleted: "auth:profile:completed",
  websocketUserConnected: "websocket:user:connected",
  websocketUserDisconnected: "websocket:user:disconnected",
} as const;
