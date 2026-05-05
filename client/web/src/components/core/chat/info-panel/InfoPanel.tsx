import { useState } from "react"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Shield01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type {
  ChatConversation,
  ChatConversationContext,
  ChatMember,
} from "@/features/chat/chat.types"

import { MemberList } from "./MemberList"

type InfoPanelProps = {
  conversation: ChatConversation | null
  context: ChatConversationContext | null
  members: ChatMember[]
  isLoading: boolean
  error: string | null
  onJoinGroup?: () => Promise<unknown>
  onLeaveGroup?: () => Promise<unknown>
  currentUserId: string | null
  onOpenContactAlias: (member: ChatMember) => void
  onPromoteMember: (member: ChatMember) => void
  onDemoteMember: (member: ChatMember) => void
}

export function InfoPanel({
  conversation,
  context,
  members,
  isLoading,
  error,
  onJoinGroup,
  onLeaveGroup,
  currentUserId,
  onOpenContactAlias,
  onPromoteMember,
  onDemoteMember,
}: InfoPanelProps) {
  const [copied, setCopied] = useState(false)

  if (!conversation) {
    return (
      <section className="flex h-full min-h-0 flex-col justify-center px-5">
        <Empty className="border border-dashed border-border/70">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={Shield01Icon} />
            </EmptyMedia>
            <EmptyTitle>No details yet</EmptyTitle>
            <EmptyDescription>Select a conversation to view details.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </section>
    )
  }

  const verifiedCount = members.filter(
    (member) => member.status === "verified"
  ).length

  const handleCopyRoomId = async () => {
    if (conversation.type !== "group") {
      return
    }

    try {
      await navigator.clipboard.writeText(conversation.id)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="px-5 py-5">
        <p className="text-[0.7rem] tracking-[0.24em] text-muted-foreground uppercase">
          Details
        </p>
        <h3 className="mt-2 text-lg font-semibold">{conversation.name}</h3>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">
          {conversation.description}
        </p>
      </div>

      <Separator />

      <div className="flex flex-col gap-4 px-5 py-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-3xl border border-border/70 bg-card/60 px-4 py-4 backdrop-blur-sm">
            <p className="text-[0.7rem] tracking-[0.18em] text-muted-foreground uppercase">
              Type
            </p>
            <p className="mt-2 text-sm font-medium">
              {conversation.type === "group" ? "Group room" : "Direct message"}
            </p>
          </div>
          <div className="rounded-3xl border border-border/70 bg-card/60 px-4 py-4 backdrop-blur-sm">
            <p className="text-[0.7rem] tracking-[0.18em] text-muted-foreground uppercase">
              Devices
            </p>
            <p className="mt-2 text-sm font-medium">{verifiedCount} verified</p>
          </div>
        </div>

        <div className="rounded-3xl border border-border/70 bg-card/60 px-4 py-4 backdrop-blur-sm">
          <p className="text-sm font-medium">Status</p>
          {isLoading ? (
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              Loading details...
            </p>
          ) : error ? (
            <p className="mt-2 text-xs leading-6 text-destructive">{error}</p>
          ) : (
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              {conversation.type === "group"
                ? `Room key status: ${
                    context?.senderKeyState?.status ?? "pending"
                  }.`
                : "Secure session is ready for this conversation."}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <Badge variant="outline">Encrypted</Badge>
            <Badge variant="outline">Live</Badge>
            <Badge variant="outline">Verified</Badge>
          </div>

          {conversation.type === "group" ? (
            <div className="mt-4 flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="rounded-2xl"
                onClick={() => void handleCopyRoomId()}
              >
                {copied ? "Copied ID" : "Copy room ID"}
              </Button>
              {onJoinGroup ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-2xl"
                  onClick={() => void onJoinGroup()}
                >
                  Join
                </Button>
              ) : null}
              {onLeaveGroup ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-2xl"
                  onClick={() => void onLeaveGroup()}
                >
                  Leave
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        {conversation.type === "group" ? (
          <div className="rounded-3xl border border-border/70 bg-card/60 px-4 py-4 backdrop-blur-sm">
            <p className="text-sm font-medium">Invite</p>
            <p className="mt-2 break-all text-xs leading-6 text-muted-foreground">
              Share this room ID with someone who should join:
            </p>
            <p className="mt-2 rounded-2xl bg-secondary/50 px-3 py-2 font-mono text-xs text-foreground/90">
              {conversation.id}
            </p>
          </div>
        ) : null}

        <div>
          <p className="mb-3 text-sm font-medium">
            {conversation.type === "group" ? "Room members" : "Participants"}
          </p>
          <MemberList
            members={members}
            isOwner={
              conversation.type === "group" &&
              conversation.room.createdBy === currentUserId
            }
            onOpenContactAlias={onOpenContactAlias}
            onPromoteMember={onPromoteMember}
            onDemoteMember={onDemoteMember}
          />
        </div>
      </div>
    </section>
  )
}
