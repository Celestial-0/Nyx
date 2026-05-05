"use client"

import { Message01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import type { ContactEntry } from "@/features/contacts/contacts.types"

function getInitials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? "")
    .join("")
}

function getShortWallet(walletAddress: string) {
  return `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
}

function getContactDisplayLabel(contact: ContactEntry) {
  return (
    contact.alias?.trim() ||
    contact.user.displayName?.trim() ||
    contact.user.username?.trim() ||
    getShortWallet(contact.user.walletAddress)
  )
}

function getContactSubLabel(contact: ContactEntry) {
  if (contact.alias?.trim()) {
    return contact.user.username?.trim()
      ? `@${contact.user.username.trim()}`
      : getShortWallet(contact.user.walletAddress)
  }

  if (contact.user.username?.trim()) {
    return `@${contact.user.username.trim()}`
  }

  return getShortWallet(contact.user.walletAddress)
}

type ContactsSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  contacts: ContactEntry[]
  onOpenConversation: (input: {
    username?: string | null
    walletAddress: string
  }) => Promise<void> | void
}

export function ContactsSheet({
  open,
  onOpenChange,
  contacts,
  onOpenConversation,
}: ContactsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full max-w-sm p-0">
        <SheetHeader className="border-b border-border/60 px-6 py-5 text-left">
          <SheetTitle>Contacts</SheetTitle>
          <SheetDescription>
            Saved people and quick conversation access.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100%-88px)]">
          <div className="flex flex-col gap-3 p-4">
            {contacts.length ? (
              contacts.map((contact) => {
                const label = getContactDisplayLabel(contact)

                return (
                  <Button
                    key={contact.user.id}
                    type="button"
                    variant="ghost"
                    className="h-auto w-full justify-start rounded-3xl border border-border/60 bg-card/50 px-4 py-3 hover:bg-accent/60"
                    onClick={() =>
                      void onOpenConversation({
                        username: contact.user.username,
                        walletAddress: contact.user.walletAddress,
                      })
                    }
                  >
                    <div className="flex w-full items-center gap-3 text-left">
                      <Avatar className="size-11 after:border-transparent">
                        <AvatarImage
                          src={`https://api.dicebear.com/9.x/lorelei/svg?seed=${encodeURIComponent(contact.user.walletAddress)}`}
                          alt={label}
                        />
                        <AvatarFallback>{getInitials(label)}</AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium">{label}</p>
                          {contact.alias ? (
                            <Badge variant="outline" className="rounded-full">
                              Saved
                            </Badge>
                          ) : null}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {getContactSubLabel(contact)}
                        </p>
                      </div>
                    </div>
                  </Button>
                )
              })
            ) : (
              <Empty className="border border-dashed border-border/60 bg-card/30">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <HugeiconsIcon icon={Message01Icon} strokeWidth={2} />
                  </EmptyMedia>
                  <EmptyTitle>No saved contacts yet</EmptyTitle>
                  <EmptyDescription>
                    Save people from chat menus and they will appear here.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent />
              </Empty>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
