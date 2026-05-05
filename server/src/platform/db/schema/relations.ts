import { relations } from "drizzle-orm";

// user
import {
  users,
  userCredits,
  creditLogs,
  userBlocks,
  userContacts,
  userDevices,
  deviceSignedPrekeys,
  deviceOneTimePrekeys,
} from "@/platform/db/schema";

// room
import {
  rooms,
  roomMembers,
  roomSenderKeyEpochs,
  roomSenderKeyShares,
} from "@/platform/db/schema";

// message
import { messages, messageDelivery, messageVisibility } from "@/platform/db/schema";

// payment
import { payments } from "@/platform/db/schema";


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
  devices: many(userDevices),

  payments: many(payments),

  creditLogs: many(creditLogs),

  blocksInitiated: many(userBlocks, {
    relationName: "blocker",
  }),

  blocksReceived: many(userBlocks, {
    relationName: "blocked",
  }),

  contactsOwned: many(userContacts, {
    relationName: "contactOwner",
  }),

  contactsReceived: many(userContacts, {
    relationName: "contactTarget",
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


// ---------------- USER CONTACTS ----------------
export const userContactsRelations = relations(userContacts, ({ one }) => ({
  owner: one(users, {
    fields: [userContacts.ownerUserId],
    references: [users.id],
    relationName: "contactOwner",
  }),

  contact: one(users, {
    fields: [userContacts.contactUserId],
    references: [users.id],
    relationName: "contactTarget",
  }),
}));


// ---------------- USER DEVICES ----------------
export const userDevicesRelations = relations(userDevices, ({ one, many }) => ({
  user: one(users, {
    fields: [userDevices.userId],
    references: [users.id],
  }),

  signedPreKey: one(deviceSignedPrekeys, {
    fields: [userDevices.id],
    references: [deviceSignedPrekeys.deviceId],
  }),

  oneTimePreKeys: many(deviceOneTimePrekeys),

  senderKeyShares: many(roomSenderKeyShares),
}));


// ---------------- DEVICE SIGNED PREKEYS ----------------
export const deviceSignedPrekeysRelations = relations(deviceSignedPrekeys, ({ one }) => ({
  device: one(userDevices, {
    fields: [deviceSignedPrekeys.deviceId],
    references: [userDevices.id],
  }),
}));


// ---------------- DEVICE ONE-TIME PREKEYS ----------------
export const deviceOneTimePrekeysRelations = relations(deviceOneTimePrekeys, ({ one }) => ({
  device: one(userDevices, {
    fields: [deviceOneTimePrekeys.deviceId],
    references: [userDevices.id],
  }),

  consumer: one(users, {
    fields: [deviceOneTimePrekeys.consumedByUserId],
    references: [users.id],
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
  senderKeyEpochs: many(roomSenderKeyEpochs),
  senderKeyShares: many(roomSenderKeyShares),
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


// ---------------- ROOM SENDER KEY EPOCHS ----------------
export const roomSenderKeyEpochsRelations = relations(roomSenderKeyEpochs, ({ one, many }) => ({
  room: one(rooms, {
    fields: [roomSenderKeyEpochs.roomId],
    references: [rooms.id],
  }),

  creator: one(users, {
    fields: [roomSenderKeyEpochs.createdByUserId],
    references: [users.id],
  }),

  creatorDevice: one(userDevices, {
    fields: [roomSenderKeyEpochs.createdByDeviceId],
    references: [userDevices.id],
  }),

  shares: many(roomSenderKeyShares),
}));


// ---------------- ROOM SENDER KEY SHARES ----------------
export const roomSenderKeySharesRelations = relations(roomSenderKeyShares, ({ one }) => ({
  epoch: one(roomSenderKeyEpochs, {
    fields: [roomSenderKeyShares.epochId],
    references: [roomSenderKeyEpochs.id],
  }),

  room: one(rooms, {
    fields: [roomSenderKeyShares.roomId],
    references: [rooms.id],
  }),

  user: one(users, {
    fields: [roomSenderKeyShares.userId],
    references: [users.id],
  }),

  device: one(userDevices, {
    fields: [roomSenderKeyShares.deviceId],
    references: [userDevices.id],
  }),

  creatorDevice: one(userDevices, {
    fields: [roomSenderKeyShares.createdByDeviceId],
    references: [userDevices.id],
    relationName: "senderKeyShareCreatorDevice",
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
