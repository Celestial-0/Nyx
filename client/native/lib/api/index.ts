/**
 * Backend API surface for the native client.
 *
 * `client` holds the shared fetch wrapper; `socket` the generic WebSocket
 * factory; each `*.api` module is a thin, Zod-validated wrapper over one group
 * of server endpoints. Import from `@/lib/api`.
 */
export * from './client';
export * from './socket';

export * as authApi from './auth.api';
export * as userApi from './user.api';
export * as chatApi from './chat.api';
export * as roomsApi from './rooms.api';
export * as contactsApi from './contacts.api';
export * as dmApi from './dm.api';
export * as paymentsApi from './payments.api';

export { createChatSocketClient, handleChatRealtimeEvent } from './chat.socket';
