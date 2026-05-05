"use client"

import { useEffect, useMemo, useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { useAuthStore } from "@/features/auth/auth.store"
import {
  updateCurrentUserProfileAction,
  useCurrentUser,
} from "@/features/user/user.hooks"

function getProfilePromptStorageKey(userId: string) {
  return `nyx-profile-prompt-dismissed:${userId}`
}

export function ProfileOnboardingDialog() {
  const authUser = useAuthStore((state) => state.user)
  const isAuthLoading = useAuthStore((state) => state.isLoading)
  const currentUser = useCurrentUser()

  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [draft, setDraft] = useState({
    username: "",
    fullName: "",
  })

  const storageKey = useMemo(
    () => (authUser ? getProfilePromptStorageKey(authUser.id) : null),
    [authUser]
  )

  const shouldPrompt =
    authUser != null &&
    !isAuthLoading &&
    (currentUser == null ||
      !currentUser.username?.trim() ||
      !currentUser.displayName?.trim())

  useEffect(() => {
    if (!shouldPrompt || !storageKey) {
      setOpen(false)
      return
    }

    if (typeof window === "undefined") {
      return
    }

    const wasDismissed = window.localStorage.getItem(storageKey) === "1"

    if (!wasDismissed) {
      setDraft({
        username: currentUser?.username ?? "",
        fullName: currentUser?.displayName ?? "",
      })
      setError(null)
      setOpen(true)
    }
  }, [
    currentUser?.displayName,
    currentUser?.username,
    isAuthLoading,
    shouldPrompt,
    storageKey,
  ])

  const dismiss = () => {
    if (typeof window !== "undefined" && storageKey) {
      window.localStorage.setItem(storageKey, "1")
    }

    setError(null)
    setOpen(false)
  }

  const handleSave = async () => {
    const username = draft.username.trim()
    const fullName = draft.fullName.trim()

    if (!username && !fullName) {
      dismiss()
      return
    }

    try {
      setIsSaving(true)
      setError(null)
      await updateCurrentUserProfileAction({
        ...(username ? { username } : {}),
        ...(fullName ? { fullName } : {}),
      })
      dismiss()
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to save your profile."
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          dismiss()
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Set up your profile</DialogTitle>
          <DialogDescription>
            Add a username or full name now, or skip and do it later.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor="profile-username">Username</FieldLabel>
            <Input
              id="profile-username"
              value={draft.username}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  username: event.target.value,
                }))
              }
              placeholder="Choose a username"
            />
            <FieldDescription>
              Usernames make you discoverable without sharing a wallet address.
            </FieldDescription>
          </Field>

          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor="profile-full-name">Full name</FieldLabel>
            <Input
              id="profile-full-name"
              value={draft.fullName}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  fullName: event.target.value,
                }))
              }
              placeholder="Add your name"
            />
          </Field>

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Profile update failed</AlertTitle>
              <AlertDescription>
                <FieldError>{error}</FieldError>
              </AlertDescription>
            </Alert>
          ) : null}
        </FieldGroup>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={dismiss}
            disabled={isSaving}
          >
            Skip for now
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
          >
            {isSaving ? <Spinner /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
