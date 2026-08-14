import { useState, useEffect } from "react"

const GITHUB_REPO_URL = "https://github.com/Celestial-0/Nyx"
const GITHUB_API_URL = "https://api.github.com/repos/Celestial-0/Nyx"
const CACHE_KEY = "nyx_gh_stars_cache"
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

interface GitHubStarButtonProps {
  variant?: "header" | "hero" | "footer" | "minimal"
  className?: string
}

function formatStarCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`
  }
  return count.toString()
}

export function useGitHubStars() {
  const [stars, setStars] = useState<number | null>(() => {
    try {
      if (typeof window !== "undefined") {
        const cached = sessionStorage.getItem(CACHE_KEY)
        if (cached) {
          const parsed = JSON.parse(cached)
          if (Date.now() - parsed.timestamp < CACHE_TTL) {
            return parsed.count
          }
        }
      }
    } catch {
      // Ignore sessionStorage errors
    }
    return null
  })
  const [isLoading, setIsLoading] = useState<boolean>(stars === null)

  useEffect(() => {
    if (stars !== null) {
      setIsLoading(false)
      return
    }

    let isMounted = true
    const fetchStars = async () => {
      try {
        const response = await fetch(GITHUB_API_URL, {
          headers: {
            Accept: "application/vnd.github.v3+json",
          },
        })
        if (!response.ok) throw new Error("Failed to fetch repo stats")
        const data = await response.json()
        const count = typeof data.stargazers_count === "number" ? data.stargazers_count : 0

        if (isMounted) {
          setStars(count)
          setIsLoading(false)
          try {
            sessionStorage.setItem(
              CACHE_KEY,
              JSON.stringify({ count, timestamp: Date.now() })
            )
          } catch {
            // Ignore sessionStorage errors
          }
        }
      } catch {
        if (isMounted) {
          // Graceful fallback to 0 or cached count
          setStars((prev) => prev ?? 0)
          setIsLoading(false)
        }
      }
    }

    void fetchStars()

    return () => {
      isMounted = false
    }
  }, [stars])

  return { stars, isLoading }
}

export function GitHubStarButton({ variant = "header", className = "" }: GitHubStarButtonProps) {
  const { stars, isLoading } = useGitHubStars()

  const formattedStars = stars !== null ? formatStarCount(stars) : "..."

  if (variant === "hero") {
    return (
      <a
        href={GITHUB_REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`group inline-flex items-center gap-2 rounded-full border border-accent-brand/40 bg-accent-brand/5 px-3.5 py-1.5 text-xs font-mono text-foreground backdrop-blur-md transition-all duration-300 hover:border-accent-brand/70 hover:bg-accent-brand/10 hover:shadow-lg hover:shadow-accent-brand/10 active:translate-y-px ${className}`}
      >
        <div className="flex items-center gap-1.5 text-accent-brand">
          <svg className="size-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
          <span className="font-semibold uppercase tracking-wider text-xs text-foreground group-hover:text-accent-brand transition-colors">
            Open Source on GitHub
          </span>
        </div>

        <span className="h-3 w-px bg-border" />

        <div className="inline-flex items-center gap-1 font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
          <svg
            className="size-3 text-amber-500 fill-amber-500"
            viewBox="0 0 24 24"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          {isLoading ? (
            <span className="inline-block h-3 w-4 animate-pulse rounded bg-muted" />
          ) : (
            <span>{formattedStars}</span>
          )}
        </div>

        <span className="text-muted-foreground group-hover:translate-x-0.5 transition-transform duration-200 text-xs">
          →
        </span>
      </a>
    )
  }

  if (variant === "footer") {
    return (
      <a
        href={GITHUB_REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-mono text-xs ${className}`}
      >
        <svg className="size-3.5 fill-current" viewBox="0 0 24 24">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
        </svg>
        <span>GitHub</span>
        <span className="rounded bg-muted/70 px-1.5 py-0.5 text-[10px] font-semibold text-foreground border border-border/60">
          ★ {formattedStars}
        </span>
      </a>
    )
  }

  // Default "header" / button variant
  return (
    <a
      href={GITHUB_REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Star Nyx on GitHub"
      className={`group relative inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-border bg-card/60 px-3 font-mono text-xs font-medium text-foreground backdrop-blur transition-all duration-200 hover:border-accent-brand/40 hover:bg-muted/50 active:translate-y-px ${className}`}
    >
      <div className="flex items-center gap-1.5">
        <svg className="size-3.5 fill-current opacity-90 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
        </svg>
        <span className="hidden sm:inline font-semibold text-xs tracking-tight">Star</span>
      </div>

      <span className="h-3 w-px bg-border/80" />

      <div className="flex items-center gap-1 text-muted-foreground group-hover:text-foreground transition-colors">
        <svg
          className="size-3 text-amber-500 fill-amber-500 transition-transform duration-200 group-hover:scale-110"
          viewBox="0 0 24 24"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
        <span className="text-[11px] font-semibold tabular-nums">
          {isLoading ? (
            <span className="inline-block h-2.5 w-4 animate-pulse rounded bg-muted" />
          ) : (
            formattedStars
          )}
        </span>
      </div>
    </a>
  )
}
