import { useDeferredValue } from "react"
import {
  Add01Icon,
  Message02Icon,
  UserAdd02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import type { ChatConversation } from "@/features/chat/chat.types"

import { ChatItem } from "./ChatItem"
import { SearchBar } from "./SearchBar"

type ChatListProps = {
  conversations: ChatConversation[]
  currentUserId: string | null
  activeConversationId: string | null
  searchQuery: string
  isLoading: boolean
  error: string | null
  onOpenDirectMessages: () => void
  onOpenGroups: () => void
  onSearchChange: (value: string) => void
  onSelectConversation: (conversationId: string) => void
  onOpenContactAlias: (conversation: ChatConversation) => void
  onRemoveContactAlias: (conversation: ChatConversation) => void
  onToggleMute: (conversation: ChatConversation) => void
  onLeaveGroup: (conversation: ChatConversation) => void
  onDeleteGroup: (conversation: ChatConversation) => void
  onlineUserIds: Set<string>
}

export function ChatList({
  conversations,
  currentUserId,
  activeConversationId,
  searchQuery,
  isLoading,
  error,
  onOpenDirectMessages,
  onOpenGroups,
  onSearchChange,
  onSelectConversation,
  onOpenContactAlias,
  onRemoveContactAlias,
  onToggleMute,
  onLeaveGroup,
  onDeleteGroup,
  onlineUserIds,
}: ChatListProps) {
  const deferredQuery = useDeferredValue(searchQuery)
  const normalizedQuery = deferredQuery.trim().toLowerCase()
  const filteredConversations = normalizedQuery
    ? conversations.filter((conversation) =>
        conversation.searchValue.includes(normalizedQuery)
      )
    : conversations
  const directConversations = filteredConversations.filter(
    (conversation) => conversation.type === "direct"
  )
  const groupConversations = filteredConversations.filter(
    (conversation) => conversation.type === "group"
  )

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-card/70 backdrop-blur-xl">
      <div className="border-b border-border/60 px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.7rem] tracking-[0.24em] text-muted-foreground uppercase">
              Inbox
            </p>
            <div className="mt-2 flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
              <span className="rounded-full bg-primary/12 px-2.5 py-1 text-[0.7rem] font-medium text-primary">
                {filteredConversations.length} live
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              title="Start direct message"
              className="rounded-2xl bg-background/50 hover:bg-secondary"
              onClick={onOpenDirectMessages}
            >
              <HugeiconsIcon icon={UserAdd02Icon} strokeWidth={2} />
              <span className="sr-only">Start direct message</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              title="Create or join group room"
              className="rounded-2xl bg-background/50 hover:bg-secondary"
              onClick={onOpenGroups}
            >
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
              <span className="sr-only">Create or join group room</span>
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <SearchBar value={searchQuery} onChange={onSearchChange} />
        </div>
      </div>

      <ScrollArea className="min-h-0 min-w-0 flex-1">
        <div className="flex min-w-0 flex-col gap-4 px-3 py-4">
          {isLoading ? (
            <div className="flex flex-col gap-3 px-2 py-1">
              {Array.from({ length: 5 }, (_, index) => (
                <div
                  key={`chat-list-skeleton-${index}`}
                  className="flex items-center gap-3 rounded-2xl px-1 py-2"
                >
                  <Skeleton className="size-11 rounded-full" />
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <Empty className="min-h-[14rem] border border-dashed border-border/70">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <HugeiconsIcon icon={Message02Icon} />
                </EmptyMedia>
                <EmptyTitle>Inbox unavailable</EmptyTitle>
                <EmptyDescription>{error}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : filteredConversations.length ? (
            <>
              {directConversations.length ? (
                <div className="flex flex-col gap-2">
                  <p className="px-2 text-[0.7rem] tracking-[0.18em] text-muted-foreground/80 uppercase">
                    Direct messages
                  </p>
                  {directConversations.map((conversation) => (
                    <ChatItem
                      key={conversation.id}
                      conversation={conversation}
                      active={conversation.id === activeConversationId}
                      onSelect={onSelectConversation}
                      onOpenContactAlias={onOpenContactAlias}
                      onRemoveContactAlias={onRemoveContactAlias}
                      onToggleMute={onToggleMute}
                      onLeaveGroup={onLeaveGroup}
                      onDeleteGroup={onDeleteGroup}
                      canDeleteGroup={
                        conversation.type === "group" &&
                        conversation.room.createdBy === currentUserId
                      }
                      isOnline={
                        conversation.type === "direct" &&
                        conversation.directPeer?.userId != null &&
                        onlineUserIds.has(conversation.directPeer.userId)
                      }
                    />
                  ))}
                </div>
              ) : null}

              {groupConversations.length ? (
                <div className="flex flex-col gap-2">
                  <p className="px-2 text-[0.7rem] tracking-[0.18em] text-muted-foreground/80 uppercase">
                    Group rooms
                  </p>
                  {groupConversations.map((conversation) => (
                    <ChatItem
                      key={conversation.id}
                      conversation={conversation}
                      active={conversation.id === activeConversationId}
                      onSelect={onSelectConversation}
                      onOpenContactAlias={onOpenContactAlias}
                      onRemoveContactAlias={onRemoveContactAlias}
                      onToggleMute={onToggleMute}
                      onLeaveGroup={onLeaveGroup}
                      onDeleteGroup={onDeleteGroup}
                      canDeleteGroup={
                        conversation.type === "group" &&
                        conversation.room.createdBy === currentUserId
                      }
                    />
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <Empty className="min-h-[14rem] border border-dashed border-border/70">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <HugeiconsIcon icon={Message02Icon} />
                </EmptyMedia>
                <EmptyTitle>No conversations yet</EmptyTitle>
                <EmptyDescription>
                  {normalizedQuery
                    ? "No conversations match this search."
                    : "Start a direct message or create a group to begin."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </ScrollArea>
    </section>
  )
}
