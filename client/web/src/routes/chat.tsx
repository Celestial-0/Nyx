import { Navigate, createFileRoute } from "@tanstack/react-router"

import { Chat } from "@/components/core/chat/chat"
import { useAuthSession } from "@/features/auth/auth.hooks"
import { Spinner } from "@/components/ui/spinner"

export const Route = createFileRoute("/chat")({ component: ChatRoute })

function ChatRoute() {
  const { isAuthenticated, isHydrated, isLoading, status } = useAuthSession()

  if (!isHydrated || isLoading || status === "idle") {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background">
        <Spinner className="size-5" />
      </main>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return <Chat />
}
