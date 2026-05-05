import { useCallback, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useWallet } from "@solana/wallet-adapter-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { WalletAuth } from "@/components/core/auth/WalletAuth"
import { useLogout } from "@/features/auth/auth.hooks"
import { useAuthStore } from "@/features/auth/auth.store"
import { useUserStore } from "@/features/user/user.store"

export function LandingHeader() {
  const navigate = useNavigate()
  const { disconnect, publicKey, connected } = useWallet()
  const [authOpen, setAuthOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const status = useAuthStore((state) => state.status)
  const profile = useUserStore((state) => state.profile)
  const { logout } = useLogout()
  const isAuthenticated = status === "authenticated"

  const avatarLabel =
    profile?.displayName?.trim() || profile?.username?.trim() || "User"
  const avatarInitial = avatarLabel.charAt(0).toUpperCase()
  const avatarSeed = profile?.walletAddress ?? avatarLabel
  const avatarUrl = `https://api.dicebear.com/9.x/lorelei/svg?seed=${encodeURIComponent(avatarSeed)}`
  const walletAddress = publicKey?.toBase58() ?? profile?.walletAddress ?? null
  const shortWallet = walletAddress
    ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
    : "Wallet connected"

  const handleSignOut = useCallback(async () => {
    try {
      await logout()
      if (connected) {
        await disconnect()
      }
    } catch (error) {
      console.error("Failed to disconnect wallet during sign out", error)
    } finally {
      setMenuOpen(false)
      setAuthOpen(false)
    }
  }, [connected, disconnect, logout])

  return (
    <>
      <header className="fixed top-0 right-0 z-50 p-4">
        <div className="relative">
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="rounded-full transition hover:opacity-90"
              aria-label="Open account menu"
              title={avatarLabel}
            >
              <Avatar size="lg" className="shadow-sm">
                <AvatarImage src={avatarUrl} alt={avatarLabel} />
                <AvatarFallback>{avatarInitial}</AvatarFallback>
              </Avatar>
            </button>
          ) : (
            <Button onClick={() => setAuthOpen(true)} className="px-4 py-2">
              Sign In with Wallet
            </Button>
          )}

          {isAuthenticated && menuOpen ? (
            <div className="absolute right-0 mt-2 w-56 rounded-lg border border-border/70 bg-background/95 p-3 shadow-lg backdrop-blur">
              <p className="text-sm font-medium">{avatarLabel}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {shortWallet}
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-3 w-full"
                onClick={() => {
                  void handleSignOut()
                }}
              >
                Sign Out
              </Button>
            </div>
          ) : null}
        </div>
      </header>
      <WalletAuth
        open={authOpen}
        onOpenChange={setAuthOpen}
        onSignedIn={() => {
          setMenuOpen(false)
          setAuthOpen(false)
          void navigate({ to: "/chat", replace: true })
        }}
      />
    </>
  )
}
