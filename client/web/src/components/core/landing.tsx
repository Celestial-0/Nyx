import { Background } from "@/components/core/landing/baground"
import { Waitlist } from "@/components/core/landing/waitlist"
import { LandingHeader } from "@/components/core/landing/header"

export const Landing = () => {
  return (
    <>
      <Background />
      {process.env.NODE_ENV != "production" && 
        <LandingHeader />
      }
      {process.env.NODE_ENV === "production" && <Waitlist />}
    </>
  )
}
