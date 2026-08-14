import { useEffect, useRef } from "react"
import { Message02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { motion } from "motion/react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import type { ChatMember, ChatMessage } from "@/features/chat/chat.types"

import { MessageBubble } from "./MessageBubble"
import { TypingIndicator } from "./TypingIndicator"

type MessageListProps = {
  currentUserId: string | null
  messages: ChatMessage[]
  membersById: Record<string, ChatMember>
  typingNames: string[]
  isLoading: boolean
  hasOlderMessages: boolean
  isLoadingOlder: boolean
  error: string | null
  peerOnline?: boolean | null
  onLoadOlderMessages: () => void
  onHideMessage: (message: ChatMessage) => void
  onDeleteMessage: (message: ChatMessage) => void
}

export function MessageList({
  currentUserId,
  messages,
  membersById,
  typingNames,
  isLoading,
  hasOlderMessages,
  isLoadingOlder,
  error,
  peerOnline,
  onLoadOlderMessages,
  onHideMessage,
  onDeleteMessage,
}: MessageListProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const fallbackSelfMember: ChatMember = {
    id: currentUserId ?? "self",
    name: "You",
    walletAddress: "",
    username: null,
    role: "You",
    memberRole: null,
    status: "verified",
    avatarSrc: "",
    deviceCount: 1,
  }
  const fallbackUnknownMember: ChatMember = {
    id: "unknown",
    name: "Member",
    walletAddress: "",
    username: null,
    role: "Member",
    memberRole: null,
    status: "limited",
    avatarSrc: "",
    deviceCount: 0,
  }

  useEffect(() => {
    const element = scrollerRef.current
    if (!element) {
      return
    }

    element.scrollTop = element.scrollHeight
  }, [messages, typingNames])

  return (
    <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-5 py-6">
        {hasOlderMessages && !isLoading && !error ? (
          <div className="flex justify-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onLoadOlderMessages}
              disabled={isLoadingOlder}
            >
              {isLoadingOlder ? "Loading older" : "Load older"}
            </Button>
          </div>
        ) : null}

        {isLoading ? (
          Array.from({ length: 4 }, (_, index) => (
            <div key={`message-skeleton-${index}`} className="flex gap-3">
              <Skeleton className="mt-1 size-8 rounded-full" />
              <div className="flex max-w-xl flex-1 flex-col gap-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-24 w-full rounded-3xl" />
              </div>
            </div>
          ))
        ) : error ? (
          <Empty className="min-h-80 border border-dashed border-border/70">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={Message02Icon} />
              </EmptyMedia>
              <EmptyTitle>History unavailable</EmptyTitle>
              <EmptyDescription>{error}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : messages.length ? (
          <>
            {!hasOlderMessages && (
              <div className="mx-auto my-2 flex max-w-md items-center justify-center gap-2 rounded-xl border border-border/40 bg-card/40 px-3.5 py-2 text-center text-[0.7rem] text-muted-foreground backdrop-blur-sm select-none">
                <svg
                  viewBox="0 0 24 24"
                  width="13"
                  height="13"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-3.5 shrink-0 text-emerald-500 dark:text-emerald-400"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span>
                  Messages are end-to-end encrypted. Only members of this chat have keys to read them.
                </span>
              </div>
            )}
            {messages.map((message) => {
              const isOwn = message.senderId === currentUserId
              const sender =
                membersById[message.senderId] ??
                (isOwn ? fallbackSelfMember : fallbackUnknownMember)

              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  sender={sender}
                  isOwn={isOwn}
                  peerOnline={peerOnline}
                  onHideMessage={onHideMessage}
                  onDeleteMessage={onDeleteMessage}
                />
              )
            })}
          </>
        ) : (
          <Empty className="min-h-80 border border-dashed border-border/70">
            <EmptyHeader>
                <EmptyMedia variant="icon">
                  <HugeiconsIcon icon={Message02Icon} />
                </EmptyMedia>
              <EmptyTitle>No messages yet</EmptyTitle>
              <EmptyDescription>
                Start the conversation with a secure message.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        <motion.div
          layout
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="min-h-6"
        >
          <TypingIndicator names={typingNames} />
        </motion.div>
      </div>
    </div>
  )
}
