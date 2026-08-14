/**
 * Core (feature) screens for the native client, mirroring the web client's
 * `components/core` tree. UI primitives live in `components/ui`; these compose
 * them with the Zustand stores and the `lib/api` layer.
 */

// auth
export { WalletAuth } from './auth/WalletAuth';
export { ProfileOnboardingDialog } from './auth/ProfileOnboardingDialog';

// landing
export { Landing } from './landing/Landing';

// chat
export { Chat } from './chat/chat';
export { ChatList } from './chat/chat-list/ChatList';
export { ChatItem } from './chat/chat-list/ChatItem';
export { SearchBar } from './chat/chat-list/SearchBar';
export { DmStartDialog } from './chat/chat-list/DmStartDialog';
export { GroupRoomDialog } from './chat/chat-list/GroupRoomDialog';
export { ChatView } from './chat/chat-view/ChatView';
export { MessageList } from './chat/chat-view/MessageList';
export { MessageBubble } from './chat/chat-view/MessageBubble';
export { MessageInput } from './chat/chat-view/MessageInput';
export { TypingIndicator } from './chat/chat-view/TypingIndicator';
export { InfoPanel } from './chat/info-panel/InfoPanel';
export { MemberList } from './chat/info-panel/MemberList';
export { Sidebar } from './chat/sidebar/Sidebar';
export { SidebarItem } from './chat/sidebar/SidebarItem';
export { SidebarProfile } from './chat/sidebar/SidebarProfile';
export { Contacts } from './chat/sidebar/Contacts';
export { Notifications } from './chat/sidebar/Notifications';
export { Settings } from './chat/sidebar/Settings';

// payments
export { PaymentsSheet } from './payments/PaymentsSheet';
export { PaymentsSummaryCard } from './payments/PaymentsSummaryCard';
export { PaymentsRechargeCard } from './payments/PaymentsRechargeCard';
export { PaymentsActivityCard } from './payments/PaymentsActivityCard';
