import { createFileRoute } from "@tanstack/react-router"
import { Landing } from "@/components/core/landing"


export const Route = createFileRoute("/")({ component: App })

function App() {
  return (
    <div className="min-h-svh">
      <Landing />
    </div>
  )
}