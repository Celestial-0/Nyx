import { useCallback, useState, useEffect } from "react"
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

  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsDark(document.documentElement.classList.contains("dark"))
    }
  }, [])

  const toggleTheme = useCallback(() => {
    const root = document.documentElement
    if (root.classList.contains("dark")) {
      root.classList.remove("dark")
      root.classList.add("light")
      setIsDark(false)
    } else {
      root.classList.remove("light")
      root.classList.add("dark")
      setIsDark(true)
    }
  }, [])

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 flex justify-center p-4">
        <div className="flex w-full max-w-5xl items-center justify-between rounded-xl border border-border bg-card/85 px-6 py-3 shadow-2xl backdrop-blur-lg">
          <div className="flex items-center gap-3">
            <img
              src="/nyx.png"
              alt="Nyx Logo"
              className="size-8 rounded-lg object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none"
              }}
            />
            <span className="font-heading text-lg font-bold tracking-wider text-foreground">
              NYX
            </span>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-8 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            <a
              href="#features"
              className="transition-colors hover:text-foreground cursor-pointer"
            >
              Features
            </a>
            <a
              href="#terminal"
              className="transition-colors hover:text-foreground cursor-pointer"
            >
              Terminal
            </a>
            <a
              href="#micropayments"
              className="transition-colors hover:text-foreground cursor-pointer"
            >
              Governance
            </a>
            <a
              href="#faq"
              className="transition-colors hover:text-foreground cursor-pointer"
            >
              FAQ
            </a>
          </div>

          <div className="flex items-center gap-4">

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="text-muted-foreground hover:text-accent-brand transition-colors cursor-pointer flex items-center justify-center font-mono text-xs gap-0.5 group h-8 px-1"
              aria-label="Toggle Theme"
            >
              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 font-bold select-none">[</span>
              {isDark ? (
                // Sun Icon (shows when dark mode)
                <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="4" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
              ) : (
                // Moon Icon (shows when light mode)
                <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 0 1 8.646 3.646 9.003 9.003 0 0 0 12 21a9.003 9.003 0 0 0 8.354-5.646z" />
                </svg>
              )}
              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 font-bold select-none">]</span>
            </button>

            {/* Wallet Sign In Actions */}
            <div className="relative">
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => setMenuOpen((open) => !open)}
                  className="flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs transition hover:bg-muted"
                  aria-label="Open account menu"
                  title={avatarLabel}
                >
                  <span className="max-w-24 truncate font-medium text-foreground">
                    {avatarLabel}
                  </span>
                  <Avatar size="sm" className="size-6 shadow-sm">
                    <AvatarImage src={avatarUrl} alt={avatarLabel} />
                    <AvatarFallback>{avatarInitial}</AvatarFallback>
                  </Avatar>
                </button>
              ) : (
                <Button
                  onClick={() => setAuthOpen(true)}
                  className="h-8 px-4 text-xs font-bold uppercase tracking-wider"
                >
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
          </div>
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
