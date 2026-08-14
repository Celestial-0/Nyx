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
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"

export type NotificationsDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NotificationsDrawer({
  open,
  onOpenChange,
}: NotificationsDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} swipeDirection="left">
      <DrawerContent className="h-full w-full max-w-sm p-0 rounded-none sm:rounded-r-2xl border-r border-border/60 bg-background/95 backdrop-blur-xl">
        <DrawerHeader className="border-b border-border/60 px-6 py-5 text-left">
          <DrawerTitle className="text-base font-semibold">Notifications</DrawerTitle>
          <DrawerDescription>
            Recent activity and conversation updates.
          </DrawerDescription>
        </DrawerHeader>

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
      </DrawerContent>
    </Drawer>
  )
}

export const NotificationsSheet = NotificationsDrawer
export type NotificationsSheetProps = NotificationsDrawerProps
