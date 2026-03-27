import { relations } from "drizzle-orm";

// user
import { users, userCredits, creditLogs, userBlocks } from "@/db/schema";

// room
import { rooms, roomMembers } from "@/db/schema";

// message
import { messages, messageDelivery, messageVisibility } from "@/db/schema";

// payment
import { payments } from "@/db/schema";


// ---------------- USERS ----------------
export const usersRelations = relations(users, ({ one, many }) => ({
  credits: one(userCredits, {
    fields: [users.id],
    references: [userCredits.userId],
  }),

  messages: many(messages),

  roomsCreated: many(rooms, {
    relationName: "creator",
  }),

  roomMemberships: many(roomMembers),

  payments: many(payments),

  creditLogs: many(creditLogs),

  blocksInitiated: many(userBlocks, {
    relationName: "blocker",
  }),

  blocksReceived: many(userBlocks, {
    relationName: "blocked",
  }),
}));


// ---------------- USER CREDITS ----------------
export const userCreditsRelations = relations(userCredits, ({ one }) => ({
  user: one(users, {
    fields: [userCredits.userId],
    references: [users.id],
  }),
}));


// ---------------- CREDIT LOGS ----------------
export const creditLogsRelations = relations(creditLogs, ({ one }) => ({
  user: one(users, {
    fields: [creditLogs.userId],
    references: [users.id],
  }),
}));


// ---------------- USER BLOCKS ----------------
export const userBlocksRelations = relations(userBlocks, ({ one }) => ({
  blocker: one(users, {
    fields: [userBlocks.blockerId],
    references: [users.id],
    relationName: "blocker",
  }),

  blocked: one(users, {
    fields: [userBlocks.blockedId],
    references: [users.id],
    relationName: "blocked",
  }),
}));


// ---------------- ROOMS ----------------
export const roomsRelations = relations(rooms, ({ one, many }) => ({
  creator: one(users, {
    fields: [rooms.createdBy],
    references: [users.id],
    relationName: "creator",
  }),

  members: many(roomMembers),

  messages: many(messages),
}));


// ---------------- ROOM MEMBERS ----------------
export const roomMembersRelations = relations(roomMembers, ({ one }) => ({
  user: one(users, {
    fields: [roomMembers.userId],
    references: [users.id],
  }),

  room: one(rooms, {
    fields: [roomMembers.roomId],
    references: [rooms.id],
  }),
}));


// ---------------- MESSAGES ----------------
export const messagesRelations = relations(messages, ({ one, many }) => ({
  room: one(rooms, {
    fields: [messages.roomId],
    references: [rooms.id],
  }),

  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),

  deliveries: many(messageDelivery),

  visibility: many(messageVisibility),
}));


// ---------------- MESSAGE DELIVERY ----------------
export const messageDeliveryRelations = relations(messageDelivery, ({ one }) => ({
  message: one(messages, {
    fields: [messageDelivery.messageId],
    references: [messages.id],
  }),

  user: one(users, {
    fields: [messageDelivery.userId],
    references: [users.id],
  }),
}));


// ---------------- MESSAGE VISIBILITY ----------------
export const messageVisibilityRelations = relations(messageVisibility, ({ one }) => ({
  message: one(messages, {
    fields: [messageVisibility.messageId],
    references: [messages.id],
  }),

  user: one(users, {
    fields: [messageVisibility.userId],
    references: [users.id],
  }),
}));


// ---------------- PAYMENTS ----------------
export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(users, {
    fields: [payments.userId],
    references: [users.id],
  }),
}));