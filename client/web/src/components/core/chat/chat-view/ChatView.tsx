import { BadgeInfoIcon, Menu01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { motion } from "motion/react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import type {
  ChatConversation,
  ChatConversationContext,
  ChatConnectionState,
  ChatMember,
  ChatMessage,
} from "@/features/chat/chat.types"

import { MessageInput } from "./MessageInput"
import { MessageList } from "./MessageList"

type ChatViewProps = {
  conversation: ChatConversation | null
  context: ChatConversationContext | null
  members: ChatMember[]
  membersById: Record<string, ChatMember>
  currentUserId: string | null
  messages: ChatMessage[]
  typingNames: string[]
  draftMessage: string
  isLoading: boolean
  hasOlderMessages: boolean
  isLoadingOlder: boolean
  error: string | null
  connectionState: ChatConnectionState
  peerOnline: boolean | null
  composerLocked: boolean
  composerNotice: string | null
  onDraftChange: (value: string) => void
  onSendMessage: () => void
  onComposerBlur: () => void
  onLoadOlderMessages: () => void
  onOpenChatList: () => void
  onOpenInfoPanel: () => void
  onHideMessage: (message: ChatMessage) => void
  onDeleteMessage: (message: ChatMessage) => void
}

function getInitials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? "")
    .join("")
}

export function ChatView({
  conversation,
  members,
  membersById,
  currentUserId,
  messages,
  typingNames,
  draftMessage,
  isLoading,
  hasOlderMessages,
  isLoadingOlder,
  error,
  connectionState,
  peerOnline,
  composerLocked,
  composerNotice,
  onDraftChange,
  onSendMessage,
  onComposerBlur,
  onLoadOlderMessages,
  onOpenChatList,
  onOpenInfoPanel,
  onHideMessage,
  onDeleteMessage,
}: ChatViewProps) {
  if (!conversation) {
    return (
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center border-b border-border/70 px-5 py-4 md:hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            onClick={onOpenChatList}
            title="Open chats"
          >
            <HugeiconsIcon icon={Menu01Icon} strokeWidth={2} />
            <span className="sr-only">Open chats</span>
          </Button>
        </div>
        <div className="flex flex-1 items-center justify-center px-5">
          <Empty className="max-w-xl border border-dashed border-border/70">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={BadgeInfoIcon} />
              </EmptyMedia>
              <EmptyTitle>No conversation selected</EmptyTitle>
              <EmptyDescription>Choose a chat to start messaging.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      </section>
    )
  }

  const leadMember =
    members.find((member) => member.id !== currentUserId) ?? members[0]

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-background/30 backdrop-blur-sm">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border/60 bg-background/70 px-5 py-4 backdrop-blur-xl"
      >
        <div className="flex min-w-0 items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="md:hidden"
            onClick={onOpenChatList}
            title="Open chats"
          >
            <HugeiconsIcon icon={Menu01Icon} strokeWidth={2} />
            <span className="sr-only">Open chats</span>
          </Button>

          {leadMember ? (
            <Avatar>
              <AvatarImage
                src={conversation.avatarSrc ?? leadMember.avatarSrc}
                alt={conversation.name}
              />
              <AvatarFallback>
                {getInitials(conversation.name) || "C"}
              </AvatarFallback>
            </Avatar>
          ) : null}

          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">
              {conversation.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {conversation.description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="hidden sm:inline-flex">
            Encrypted
          </Badge>
          <Badge variant="outline">
            {conversation.type === "group"
              ? `${members.length} members`
              : "Direct message"}
          </Badge>
          <Badge variant="outline">
            {connectionState !== "connected"
              ? connectionState === "connecting"
                ? "Connecting"
                : "Offline"
              : conversation.type === "direct" && peerOnline !== null
                ? peerOnline
                  ? "Peer Online"
                  : "Peer Offline"
                : "Live"}
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            onClick={onOpenInfoPanel}
            title="Open conversation details"
          >
            <HugeiconsIcon icon={BadgeInfoIcon} strokeWidth={2} />
            <span className="sr-only">Open conversation details</span>
          </Button>
        </div>
      </motion.header>

      <MessageList
        currentUserId={currentUserId}
        messages={messages}
        membersById={membersById}
        typingNames={typingNames}
        isLoading={isLoading}
        hasOlderMessages={hasOlderMessages}
        isLoadingOlder={isLoadingOlder}
        error={error}
        onLoadOlderMessages={onLoadOlderMessages}
        onHideMessage={onHideMessage}
        onDeleteMessage={onDeleteMessage}
      />

      <MessageInput
        value={draftMessage}
        onChange={onDraftChange}
        onSend={onSendMessage}
        onBlur={onComposerBlur}
        disabled={composerLocked}
        notice={composerNotice}
      />
    </section>
  )
}
