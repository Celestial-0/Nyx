"use client"

import { useMemo } from "react"
import {
  Clock01Icon,
  Image01Icon,
  Shield01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { motion } from "motion/react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { ChatMember, ChatMessage, ChatMessageDeliveryState } from "@/features/chat/chat.types"

type MessageBubbleProps = {
  message: ChatMessage
  sender: ChatMember
  isOwn: boolean
  peerOnline?: boolean | null
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

function DeliveryTickIcon({
  deliveryState,
  className,
}: {
  deliveryState: ChatMessageDeliveryState
  className?: string
}) {
  if (deliveryState === "sending") {
    return (
      <HugeiconsIcon
        icon={Clock01Icon}
        strokeWidth={2.2}
        className={cn("size-3.5 shrink-0 animate-pulse opacity-70", className)}
      />
    )
  }

  if (deliveryState === "stored") {
    // Single checkmark: Sent to server relay
    return (
      <svg
        viewBox="0 0 16 15"
        width="14"
        height="13"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn("size-3.5 shrink-0 text-primary-foreground/70", className)}
        aria-hidden="true"
      >
        <path d="M3.5 8.5L6.5 11.5L13.5 4.5" />
      </svg>
    )
  }

  if (deliveryState === "read") {
    // Glowing Blue double checkmark: Peer is online / Message read
    return (
      <svg
        viewBox="0 0 16 15"
        width="15"
        height="13"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(
          "size-3.5 shrink-0 text-sky-400 drop-shadow-[0_0_4px_rgba(56,189,248,0.7)]",
          className
        )}
        aria-hidden="true"
      >
        <path d="M1.5 8.5L4.5 11.5L11.5 4.5" />
        <path d="M5.5 8.5L8.5 11.5L15.5 4.5" />
      </svg>
    )
  }

  if (deliveryState === "rejected") {
    return (
      <svg
        viewBox="0 0 16 16"
        width="13"
        height="13"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn("size-3.5 shrink-0 text-red-400", className)}
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="6" />
        <path d="M8 5v4" />
        <path d="M8 12h.01" />
      </svg>
    )
  }

  // Default: Delivered (double checkmark in white/neutral)
  return (
    <svg
      viewBox="0 0 16 15"
      width="15"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-3.5 shrink-0 text-primary-foreground/85", className)}
      aria-hidden="true"
    >
      <path d="M1.5 8.5L4.5 11.5L11.5 4.5" />
      <path d="M5.5 8.5L8.5 11.5L15.5 4.5" />
    </svg>
  )
}

function getDeliveryTooltip(deliveryState: ChatMessageDeliveryState, peerOnline?: boolean | null) {
  switch (deliveryState) {
    case "sending":
      return "Encrypting and sending..."
    case "stored":
      return "Sent to server · Peer offline"
    case "delivered":
      return "Delivered to device · End-to-end encrypted"
    case "read":
      return peerOnline === true
        ? "Read · Peer is active in session"
        : "Read · End-to-end encrypted"
    case "rejected":
      return "Delivery rejected"
    default:
      return "Delivered · End-to-end encrypted"
  }
}

export function MessageBubble({
  message,
  sender,
  isOwn,
  peerOnline,
  onHideMessage,
  onDeleteMessage,
}: MessageBubbleProps) {
  const effectiveDeliveryState: ChatMessageDeliveryState = useMemo(() => {
    if (message.deliveryState === "sending" || message.deliveryState === "rejected") {
      return message.deliveryState
    }

    if (message.deliveryState === "read") {
      return "read"
    }

    if (message.deliveryState === "delivered") {
      return "delivered"
    }

    // In direct conversations, if peer is online and active, messages transition to read/delivered
    if (peerOnline === true) {
      return "read"
    }

    return "stored"
  }, [message.deliveryState, peerOnline])

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className={cn("flex gap-2.5", isOwn && "justify-end")}
        >
          {!isOwn ? (
            <Avatar size="sm" className="mt-0.5 size-7">
              <AvatarImage src={sender.avatarSrc} alt={sender.name} />
              <AvatarFallback className="text-[0.65rem]">{getInitials(sender.name) || "U"}</AvatarFallback>
            </Avatar>
          ) : null}

          <div className="max-w-xl">
            {!isOwn ? (
              <p className="mb-1 px-1 text-[0.7rem] font-medium text-muted-foreground">
                {sender.name}
              </p>
            ) : null}

            <div
              className={cn(
                "rounded-2xl border px-3.5 py-2 shadow-xs backdrop-blur-sm",
                isOwn
                  ? "border-primary/30 bg-primary text-primary-foreground"
                  : "border-border/60 bg-card/80 text-foreground"
              )}
            >
              <p className="text-sm leading-relaxed select-text break-words">
                {message.previewFallback && message.kind === "image"
                  ? "Media message"
                  : message.previewText}
              </p>

              <div
                className={cn(
                  "mt-1 flex items-center gap-1.5 text-[0.65rem] select-none",
                  isOwn
                    ? "justify-end text-primary-foreground/80"
                    : "justify-start text-muted-foreground"
                )}
              >
                {/* Timestamp */}
                <span>{formatTimestamp(message.createdAt)}</span>

                {/* Media indicator */}
                {message.kind === "image" ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <span className="inline-flex cursor-default items-center">
                          <HugeiconsIcon
                            icon={Image01Icon}
                            strokeWidth={2}
                            className="size-3.5 shrink-0"
                          />
                        </span>
                      }
                    />
                    <TooltipContent side="top" sideOffset={4}>
                      Media attachment
                    </TooltipContent>
                  </Tooltip>
                ) : null}

                {/* Offline Fallback anomaly warning icon */}
                {message.previewFallback ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <span className="inline-flex cursor-default items-center">
                          <HugeiconsIcon
                            icon={Shield01Icon}
                            strokeWidth={2}
                            className="size-3.5 shrink-0 text-amber-400"
                          />
                        </span>
                      }
                    />
                    <TooltipContent side="top" sideOffset={4}>
                      Encrypted payload (offline fallback)
                    </TooltipContent>
                  </Tooltip>
                ) : null}

                {/* Delivery checkmark with single/double/blue tick logic */}
                {isOwn ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <span className="inline-flex cursor-default items-center">
                          <DeliveryTickIcon deliveryState={effectiveDeliveryState} />
                        </span>
                      }
                    />
                    <TooltipContent side="top" sideOffset={4}>
                      {getDeliveryTooltip(effectiveDeliveryState, peerOnline)}
                    </TooltipContent>
                  </Tooltip>
                ) : null}
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
