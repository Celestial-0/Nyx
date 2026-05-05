"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type DeleteGroupDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDelete: () => Promise<void> | void
}

export function DeleteGroupDialog({
  open,
  onOpenChange,
  onDelete,
}: DeleteGroupDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="default">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete group permanently?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the room, members, and message history for everyone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            className="rounded-2xl"
            onClick={() => void onDelete()}
          >
            Delete group
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
