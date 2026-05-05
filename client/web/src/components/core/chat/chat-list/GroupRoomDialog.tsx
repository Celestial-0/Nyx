"use client"

import { useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type GroupRoomDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateGroup: () => Promise<unknown>
  onJoinGroup: (roomId: string) => Promise<unknown>
}

export function GroupRoomDialog({
  open,
  onOpenChange,
  onCreateGroup,
  onJoinGroup,
}: GroupRoomDialogProps) {
  const [activeTab, setActiveTab] = useState("create")
  const [roomId, setRoomId] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setRoomId("")
          setError(null)
          setIsSubmitting(false)
          setActiveTab("create")
        }

        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="max-w-lg gap-0 overflow-hidden rounded-[2rem] border border-border/60 bg-background/95 p-0 backdrop-blur-xl">
        <DialogHeader className="border-b border-border/60 px-6 py-5">
          <DialogTitle>Group rooms</DialogTitle>
          <DialogDescription>Create a new room or join with a room ID.</DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="gap-0"
        >
          <TabsList className="mx-6 mt-5 rounded-2xl bg-secondary/70">
            <TabsTrigger value="create">Create room</TabsTrigger>
            <TabsTrigger value="join">Join room</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="px-6 py-5">
            <div className="rounded-[1.6rem] border border-border/60 bg-secondary/25 p-5">
              <p className="text-sm font-medium">Create an encrypted group room</p>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">
                The room will appear in your group list right away.
              </p>
              <Button
                type="button"
                className="mt-5 rounded-2xl"
                disabled={isSubmitting}
                onClick={async () => {
                  try {
                    setIsSubmitting(true)
                    setError(null)
                    await onCreateGroup()
                    onOpenChange(false)
                  } catch (createError) {
                    setError(
                      createError instanceof Error
                        ? createError.message
                        : "Failed to create group room"
                    )
                  } finally {
                    setIsSubmitting(false)
                  }
                }}
              >
                Create group
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="join" className="px-6 py-5">
            <div className="flex flex-col gap-4 rounded-[1.6rem] border border-border/60 bg-secondary/25 p-5">
              <div>
                <p className="text-sm font-medium">Join by room ID</p>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">
                  Paste a room ID to join the conversation.
                </p>
              </div>

              <Input
                value={roomId}
                onChange={(event) => setRoomId(event.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
                className="h-11 rounded-2xl bg-background/70"
              />

              <Button
                type="button"
                className="rounded-2xl"
                disabled={isSubmitting || !roomId.trim()}
                onClick={async () => {
                  try {
                    setIsSubmitting(true)
                    setError(null)
                    await onJoinGroup(roomId.trim())
                    onOpenChange(false)
                  } catch (joinError) {
                    setError(
                      joinError instanceof Error
                        ? joinError.message
                        : "Failed to join room"
                    )
                  } finally {
                    setIsSubmitting(false)
                  }
                }}
              >
                Join room
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {error ? (
          <div className="px-6 pb-6">
            <Alert variant="destructive">
              <AlertTitle>Room action failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
