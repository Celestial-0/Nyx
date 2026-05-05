type TypingIndicatorProps = {
  names: string[]
}

export function TypingIndicator({ names }: TypingIndicatorProps) {
  if (!names.length) {
    return null
  }

  const label =
    names.length === 1
      ? `${names[0]} is typing`
      : `${names.slice(0, 2).join(" and ")} are typing`

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground">
      <span>{label}</span>
      <span className="flex items-center gap-1" aria-hidden="true">
        <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground" />
        <span
          className="size-1.5 animate-pulse rounded-full bg-muted-foreground"
          style={{ animationDelay: "120ms" }}
        />
        <span
          className="size-1.5 animate-pulse rounded-full bg-muted-foreground"
          style={{ animationDelay: "240ms" }}
        />
      </span>
    </div>
  )
}
