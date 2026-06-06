import { Background } from "@/components/core/landing/baground"
import { Waitlist } from "@/components/core/landing/waitlist"
import { LandingHeader } from "@/components/core/landing/header"

export function Landing() {
  return (
    <>
      <Background />
      <LandingHeader />
      {import.meta.env.DEV && <Waitlist />}
    </>
  )
}
