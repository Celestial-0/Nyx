import { Navigate, createFileRoute } from "@tanstack/react-router"
import { Landing } from "@/components/core/landing/Landing"
import { useAuthSession } from "@/features/auth/auth.hooks"

export const Route = createFileRoute("/")({ component: App })

function App() {
  const { isAuthenticated, isHydrated } = useAuthSession()

  if (isHydrated && isAuthenticated) {
    return <Navigate to="/chat" replace />
  }

  return (
    <div className="min-h-svh">
      <Landing />
    </div>
  )
}
