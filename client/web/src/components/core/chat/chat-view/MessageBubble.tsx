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
import type { ChatMember, ChatMessage } from "@/features/chat/chat.types"
import { motion } from "motion/react"

type MessageBubbleProps = {
  message: ChatMessage
  sender: ChatMember
  isOwn: boolean
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

function formatTimestamp(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

export function MessageBubble({
  message,
  sender,
  isOwn,
  onHideMessage,
  onDeleteMessage,
}: MessageBubbleProps) {
  const statusLabel =
    message.deliveryState === "stored"
      ? "Delivered"
      : message.deliveryState === "sending"
        ? "Sending"
        : message.deliveryState.charAt(0).toUpperCase() +
          message.deliveryState.slice(1)

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={cn("flex gap-3", isOwn && "justify-end")}
        >
          {!isOwn ? (
            <Avatar size="sm" className="mt-1">
              <AvatarImage src={sender.avatarSrc} alt={sender.name} />
              <AvatarFallback>{getInitials(sender.name) || "U"}</AvatarFallback>
            </Avatar>
          ) : null}

          <div className="max-w-[min(38rem,100%)]">
            {!isOwn ? (
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                {sender.name}
              </p>
            ) : null}

            <div
              className={cn(
                "rounded-[1.6rem] border px-4 py-3 shadow-sm backdrop-blur-sm",
                isOwn
                  ? "border-primary/30 bg-primary text-primary-foreground"
                  : "border-border/60 bg-card/80 text-foreground"
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={isOwn ? "secondary" : "outline"}>
                  {message.previewFallback ? "Encrypted" : "Secure"}
                </Badge>
                {message.kind === "image" ? (
                  <Badge variant={isOwn ? "secondary" : "outline"}>Media</Badge>
                ) : null}
              </div>
              <p className="mt-3 text-sm leading-6">
                {message.previewFallback && message.kind === "image"
                  ? "Media message"
                  : message.previewText}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[0.7rem] opacity-70">
                <span>{formatTimestamp(message.createdAt)}</span>
                <span>{statusLabel}</span>
              </div>
            </div>
          </div>
        </motion.div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {message.kind === "text" ? (
          <ContextMenuItem
            onClick={() => void navigator.clipboard.writeText(message.previewText)}
          >
            Copy text
          </ContextMenuItem>
        ) : null}
        <ContextMenuItem onClick={() => onHideMessage(message)}>
          Delete for me
        </ContextMenuItem>
        {isOwn && message.canDeleteForEveryone ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              variant="destructive"
              onClick={() => onDeleteMessage(message)}
            >
              Delete for everyone
            </ContextMenuItem>
          </>
        ) : null}
      </ContextMenuContent>
    </ContextMenu>
  )
}
