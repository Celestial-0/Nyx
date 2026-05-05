import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import type { ChatMember } from "@/features/chat/chat.types"

type MemberListProps = {
  members: ChatMember[]
  isOwner: boolean
  onOpenContactAlias: (member: ChatMember) => void
  onPromoteMember: (member: ChatMember) => void
  onDemoteMember: (member: ChatMember) => void
}

function getInitials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? "")
    .join("")
}

export function MemberList({
  members,
  isOwner,
  onOpenContactAlias,
  onPromoteMember,
  onDemoteMember,
}: MemberListProps) {
  return (
    <div className="flex flex-col gap-3">
      {members.map((member) => (
        <ContextMenu key={member.id}>
          <ContextMenuTrigger>
            <div className="flex items-center justify-between rounded-2xl border border-border/70 px-3 py-3">
              <div className="flex items-center gap-3">
                <Avatar size="sm">
                  <AvatarImage src={member.avatarSrc} alt={member.name} />
                  <AvatarFallback>{getInitials(member.name) || "U"}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{member.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {member.role} • {member.deviceCount} device
                    {member.deviceCount === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <Badge variant="outline">
                {member.status === "verified" ? "Verified" : "Limited"}
              </Badge>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-48">
            <ContextMenuItem onClick={() => onOpenContactAlias(member)}>
              Save or edit contact
            </ContextMenuItem>
            {isOwner && member.memberRole ? (
              <>
                <ContextMenuSeparator />
                {member.memberRole === "member" ? (
                  <ContextMenuItem onClick={() => onPromoteMember(member)}>
                    Make admin
                  </ContextMenuItem>
                ) : (
                  <ContextMenuItem onClick={() => onDemoteMember(member)}>
                    Remove admin
                  </ContextMenuItem>
                )}
              </>
            ) : null}
          </ContextMenuContent>
        </ContextMenu>
      ))}
    </div>
  )
}
