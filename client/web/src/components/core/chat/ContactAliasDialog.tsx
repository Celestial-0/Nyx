"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type ContactAliasDialogProps = {
  open: boolean
  label: string | null
  value: string
  onValueChange: (value: string) => void
  onOpenChange: (open: boolean) => void
  onSave: () => Promise<void> | void
}

export function ContactAliasDialog({
  open,
  label,
  value,
  onValueChange,
  onOpenChange,
  onSave,
}: ContactAliasDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl border border-border/70 bg-popover/95 p-6">
        <DialogHeader>
          <DialogTitle>Save contact</DialogTitle>
          <DialogDescription>
            Set a private name for {label ?? "this contact"}.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldContent>
              <FieldTitle>Saved name</FieldTitle>
            </FieldContent>
            <Input
              value={value}
              onChange={(event) => onValueChange(event.target.value)}
              placeholder="Add a private alias"
              className="rounded-2xl"
            />
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="rounded-2xl"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-2xl"
            onClick={() => void onSave()}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
