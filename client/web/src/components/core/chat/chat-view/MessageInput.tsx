import type { KeyboardEvent } from "react"
import { ArrowUp01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { motion } from "motion/react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

type MessageInputProps = {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onBlur?: () => void
  disabled?: boolean
  notice?: string | null
}

export function MessageInput({
  value,
  onChange,
  onSend,
  onBlur,
  disabled = false,
  notice,
}: MessageInputProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (disabled) {
      return
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      onSend()
    }
  }

  return (
    <div className="bg-background/75 px-5 py-4 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
        {notice ? (
          disabled ? (
            <Alert className="rounded-2xl border-border/60 bg-secondary/40">
              <AlertTitle>Messaging unavailable</AlertTitle>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          ) : (
            <div className="rounded-2xl border border-border/60 bg-secondary/30 px-4 py-3">
              <p className="text-sm font-medium text-foreground">
                Encryption update pending
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{notice}</p>
            </div>
          )
        ) : null}

        <motion.div
          layout
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="rounded-[1.5rem] border border-border/60 bg-card/85 p-3 shadow-sm"
        >
          <Textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={onBlur}
            placeholder={disabled ? "Message unavailable" : "Message"}
            disabled={disabled}
            className="min-h-24 border-0 bg-transparent px-2 py-2 shadow-none focus-visible:ring-0"
          />
          <Button
            type="button"
            onClick={onSend}
            className="mt-3 ml-auto rounded-2xl px-4"
            disabled={disabled || !value.trim()}
          >
            <HugeiconsIcon
              icon={ArrowUp01Icon}
              data-icon="inline-start"
              strokeWidth={2}
            />
            Send
          </Button>
        </motion.div>
      </div>
    </div>
  )
}
