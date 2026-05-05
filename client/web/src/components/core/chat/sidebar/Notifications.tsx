"use client"

import { Notification03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

type NotificationsSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NotificationsSheet({
  open,
  onOpenChange,
}: NotificationsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-sm p-0">
        <SheetHeader className="border-b border-border/60 px-6 py-5 text-left">
          <SheetTitle>Notifications</SheetTitle>
          <SheetDescription>
            Recent activity and conversation updates.
          </SheetDescription>
        </SheetHeader>

        <div className="p-6">
          <Empty className="border border-dashed border-border/60 bg-card/30">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={Notification03Icon} strokeWidth={2} />
              </EmptyMedia>
              <EmptyTitle>No notifications yet</EmptyTitle>
              <EmptyDescription>
                New mentions, room updates, and message activity will appear here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      </SheetContent>
    </Sheet>
  )
}
