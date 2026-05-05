import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { cn } from "@/lib/utils"
import type { ChatConversation } from "@/features/chat/chat.types"
import { motion } from "motion/react"

type ChatItemProps = {
  conversation: ChatConversation
  active: boolean
  onSelect: (conversationId: string) => void
  onOpenContactAlias: (conversation: ChatConversation) => void
  onRemoveContactAlias: (conversation: ChatConversation) => void
  onToggleMute: (conversation: ChatConversation) => void
  onLeaveGroup: (conversation: ChatConversation) => void
  onDeleteGroup: (conversation: ChatConversation) => void
  canDeleteGroup: boolean
  isOnline?: boolean
}

function getInitials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? "")
    .join("")
}

export function ChatItem({
  conversation,
  active,
  onSelect,
  onOpenContactAlias,
  onRemoveContactAlias,
  onToggleMute,
  onLeaveGroup,
  onDeleteGroup,
  canDeleteGroup,
  isOnline = false,
}: ChatItemProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <motion.div
          role="button"
          tabIndex={0}
          whileHover={{ y: -1, scale: 1.005 }}
          whileTap={{ scale: 0.99 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          onClick={() => onSelect(conversation.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              onSelect(conversation.id)
            }
          }}
          className={cn(
            "flex w-full min-w-0 cursor-pointer items-center gap-3 overflow-hidden rounded-[1.4rem] border border-transparent px-3 py-3 text-left transition-all duration-200 hover:border-border/50 hover:bg-secondary/60",
            active && "border-border/60 bg-secondary/85 shadow-sm"
          )}
        >
          <div className="relative">
            <Avatar className="size-11 ring-1 ring-border/50">
              <AvatarImage src={conversation.avatarSrc} alt={conversation.name} />
              <AvatarFallback>{getInitials(conversation.name) || "C"}</AvatarFallback>
            </Avatar>
            {isOnline ? (
              <span className="absolute bottom-0 right-0 block size-3 rounded-full border-2 border-background bg-emerald-500" />
            ) : null}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-sm font-medium">
                {conversation.name}
              </p>
              <span className="shrink-0 text-[0.7rem] text-muted-foreground">
                {conversation.lastActivityLabel}
              </span>
            </div>
            <p className="mt-1 truncate text-[0.72rem] text-muted-foreground">
              {conversation.description}
            </p>
            <p
              className={cn(
                "mt-1 truncate text-xs",
                conversation.lastMessagePreviewFallback
                  ? "text-muted-foreground"
                  : "text-foreground/80"
              )}
            >
              {conversation.lastMessagePreview}
            </p>
          </div>

          {conversation.unreadCount > 0 ? (
            <Badge variant="secondary" className="rounded-full px-2">
              {conversation.unreadCount}
            </Badge>
          ) : null}
        </motion.div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        {conversation.type === "direct" ? (
          <>
            <ContextMenuItem onClick={() => onOpenContactAlias(conversation)}>
              {conversation.directPeer ? "Save or edit contact" : "Save contact"}
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onRemoveContactAlias(conversation)}>
              Remove saved contact
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        ) : (
          <>
            <ContextMenuItem
              onClick={() => void navigator.clipboard.writeText(conversation.id)}
            >
              Copy room ID
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}

        <ContextMenuItem onClick={() => onToggleMute(conversation)}>
          {conversation.mutedUntil ? "Unmute" : "Mute"}
        </ContextMenuItem>

        {conversation.type === "group" ? (
          <>
            <ContextMenuItem onClick={() => onLeaveGroup(conversation)}>
              Leave group
            </ContextMenuItem>
            {canDeleteGroup ? (
              <ContextMenuItem
                variant="destructive"
                onClick={() => onDeleteGroup(conversation)}
              >
                Delete group permanently
              </ContextMenuItem>
            ) : null}
          </>
        ) : null}
      </ContextMenuContent>
    </ContextMenu>
  )
}
