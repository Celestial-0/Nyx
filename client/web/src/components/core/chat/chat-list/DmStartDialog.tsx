"use client"

import { useEffect, useMemo, useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import type { UserDirectoryEntry } from "@/features/user/user.types"

type DmStartDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  searchUsers: (query: string) => Promise<UserDirectoryEntry[]>
  onStartDirectConversation: (input: {
    username?: string
    walletAddress?: string
  }) => Promise<unknown>
}

function getInitials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? "")
    .join("")
}

function getDisplayName(user: UserDirectoryEntry) {
  return (
    user.displayName?.trim() ||
    user.username?.trim() ||
    `${user.walletAddress.slice(0, 4)}...${user.walletAddress.slice(-4)}`
  )
}

export function DmStartDialog({
  open,
  onOpenChange,
  searchUsers,
  onStartDirectConversation,
}: DmStartDialogProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<UserDirectoryEntry[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setQuery("")
      setResults([])
      setError(null)
      setIsSearching(false)
      setIsStarting(false)
      return
    }

    const trimmedQuery = query.trim()

    if (trimmedQuery.length < 2) {
      setResults([])
      setError(null)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      try {
        setIsSearching(true)
        setError(null)
        const nextResults = await searchUsers(trimmedQuery)

        if (!cancelled) {
          setResults(nextResults)
        }
      } catch (searchError) {
        if (!cancelled) {
          setError(
            searchError instanceof Error
              ? searchError.message
              : "Failed to search users"
          )
        }
      } finally {
        if (!cancelled) {
          setIsSearching(false)
        }
      }
    }, 220)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [open, query, searchUsers])

  const hasQuery = query.trim().length >= 2
  const emptyLabel = useMemo(() => {
    if (!hasQuery) {
      return "Search by username or display name"
    }

    if (isSearching) {
      return "Searching for people"
    }

    return "No matching users found"
  }, [hasQuery, isSearching])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden rounded-[2rem] border border-border/60 bg-background/95 p-0 backdrop-blur-xl">
        <DialogHeader className="border-b border-border/60 px-6 py-5">
          <DialogTitle>Start a direct message</DialogTitle>
          <DialogDescription>Search for someone and open a secure conversation.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-6 py-5">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search users"
            className="h-11 rounded-2xl bg-background/70"
          />

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Search unavailable</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <ScrollArea className="h-80 border-t border-border/50 px-3 py-3">
          <div className="flex flex-col gap-2 px-3">
            {isSearching ? (
              Array.from({ length: 5 }, (_, index) => (
                <div
                  key={`dm-search-skeleton-${index}`}
                  className="flex items-center gap-3 rounded-3xl px-3 py-3"
                >
                  <Skeleton className="size-11 rounded-full" />
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-52" />
                  </div>
                </div>
              ))
            ) : results.length ? (
              results.map((user) => {
                const displayName = getDisplayName(user)
                const avatarSeed = user.walletAddress ?? user.id

                return (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 rounded-3xl border border-transparent px-3 py-3 transition-all duration-200 hover:border-border/60 hover:bg-secondary/60"
                  >
                    <Avatar className="size-11">
                      <AvatarImage
                        src={`https://api.dicebear.com/9.x/lorelei/svg?seed=${encodeURIComponent(avatarSeed)}`}
                        alt={displayName}
                      />
                      <AvatarFallback>{getInitials(displayName) || "U"}</AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{displayName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {user.username ? `@${user.username}` : user.walletAddress}
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="secondary"
                      className="rounded-2xl"
                      disabled={isStarting}
                      onClick={async () => {
                        try {
                          setIsStarting(true)
                          setError(null)
                          await onStartDirectConversation({
                            walletAddress: user.walletAddress,
                          })
                          onOpenChange(false)
                        } catch (startError) {
                          setError(
                            startError instanceof Error
                              ? startError.message
                              : "Failed to start direct conversation"
                          )
                        } finally {
                          setIsStarting(false)
                        }
                      }}
                    >
                      Message
                    </Button>
                  </div>
                )
              })
            ) : (
              <Empty className="min-h-[16rem] border border-dashed border-border/60 bg-secondary/20">
                <EmptyHeader>
                  <EmptyTitle>{emptyLabel}</EmptyTitle>
                  <EmptyDescription>
                    {hasQuery
                      ? "Try a different username."
                      : "Search by name, username, or wallet address."}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
