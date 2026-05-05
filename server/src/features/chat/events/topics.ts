export const chatEventTopics = {
  messageSubmitted: "chat:message:submitted",
  messageCreated: "chat:message:created",
  deliveryUpdated: "chat:delivery:updated",
  messageDeleted: "chat:message:deleted",
  messageRead: "chat:message:read",
  userOnline: "presence:user:online",
  userOffline: "presence:user:offline",
  typingStarted: "presence:typing:started",
  typingStopped: "presence:typing:stopped",
} as const;
