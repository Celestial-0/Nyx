"use client"

import { useState, useCallback, type ReactNode } from "react"
import {
  AccountSetting01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  BellDotIcon,
  BubbleChatIcon,
  ContactIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { motion } from "motion/react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import { SidebarItem, type SidebarItemProps } from "./SidebarItem"
import { SidebarProfile, type SidebarProfileProps } from "./SidebarProfile"

export type SidebarNavItem = Omit<SidebarItemProps, "active"> & {
  id: string
  active?: boolean
  match?: "exact" | "prefix"
}

export type SidebarProps = {
  className?: string
  logo?: ReactNode
  pathname?: string
  items?: SidebarNavItem[]
  profile?: SidebarProfileProps | null
  settingsItem?:
    | (Omit<SidebarItemProps, "icon" | "label"> & {
        icon?: IconSvgElement
        label?: string
      })
    | null
  isExpanded?: boolean
  onToggleExpanded?: () => void
}

export const defaultSidebarItems: SidebarNavItem[] = [
  {
    id: "chats",
    label: "Chats",
    icon: BubbleChatIcon,
    href: "/chats",
    match: "prefix",
  },
  {
    id: "contacts",
    label: "Contacts",
    icon: ContactIcon,
    href: "/contacts",
    match: "prefix",
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: BellDotIcon,
    href: "/notifications",
    match: "prefix",
  },
]

function matchesPath(
  pathname: string | undefined,
  href: string | undefined,
  match: SidebarNavItem["match"] = "exact"
) {
  if (!pathname || !href) {
    return false
  }

  if (href === "/") {
    return pathname === href
  }

  if (match === "prefix") {
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return pathname === href
}

export function Sidebar({
  className,
  pathname,
  items = defaultSidebarItems,
  profile = {
    name: "Nyx User",
    status: "online",
    href: "/profile",
  },
  settingsItem: _settingsItem,
  isExpanded: controlledExpanded,
  onToggleExpanded,
}: SidebarProps) {
  const [internalExpanded, setInternalExpanded] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("nyx_sidebar_expanded") === "true"
    }
    return false
  })

  const isExpanded = controlledExpanded ?? internalExpanded

  const handleToggle = useCallback(() => {
    if (onToggleExpanded) {
      onToggleExpanded()
    } else {
      setInternalExpanded((prev) => {
        const next = !prev
        if (typeof window !== "undefined") {
          localStorage.setItem("nyx_sidebar_expanded", String(next))
        }
        return next
      })
    }
  }, [onToggleExpanded])

  return (
    <TooltipProvider delay={100}>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex h-screen flex-col justify-between overflow-hidden border-r border-border/60 bg-background/90 py-4 backdrop-blur-xl transition-[width] duration-200 ease-out",
          isExpanded ? "w-64 px-4" : "w-20 px-3",
          className
        )}
      >
        <div className="flex flex-col gap-3">
          {/* Header with Logo and Expand/Collapse Arrow */}
          <div
            className={cn(
              "flex items-center",
              isExpanded ? "justify-between px-1" : "justify-center"
            )}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <img
                src="/nyx.png"
                alt="Nyx"
                className="size-11 shrink-0 rounded-2xl border border-border/50 bg-card/70 object-contain p-1.5 shadow-xs sm:size-12"
              />
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15 }}
                  className="min-w-0"
                >
                  <p className="truncate text-base font-semibold tracking-tight text-foreground">
                    Nyx
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    Messages
                  </p>
                </motion.div>
              )}
            </div>

            {isExpanded && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={handleToggle}
                      className="size-8 shrink-0 rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground"
                      aria-label="Collapse sidebar"
                    >
                      <HugeiconsIcon
                        icon={ArrowLeft01Icon}
                        strokeWidth={2}
                        className="size-4"
                      />
                    </Button>
                  }
                />
                <TooltipContent side="right" sideOffset={8}>
                  Collapse sidebar
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* When collapsed, show expand arrow button */}
          {!isExpanded && (
            <div className="flex w-full justify-center">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={handleToggle}
                      className="size-7 rounded-lg text-muted-foreground/70 hover:bg-secondary hover:text-foreground"
                      aria-label="Expand sidebar"
                    >
                      <HugeiconsIcon
                        icon={ArrowRight01Icon}
                        strokeWidth={2}
                        className="size-3.5"
                      />
                    </Button>
                  }
                />
                <TooltipContent side="right" sideOffset={12}>
                  Expand sidebar
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>

        {/* Navigation items */}
        <nav
          aria-label="Chat sidebar"
          className="flex flex-1 items-center justify-center py-4"
        >
          <div className="flex w-full flex-col items-center gap-2">
            {items.map(({ id, active, match, ...item }) => (
              <SidebarItem
                key={id}
                active={active ?? matchesPath(pathname, item.href, match)}
                expanded={isExpanded}
                {...item}
              />
            ))}
          </div>
        </nav>

        {/* Bottom Profile and Settings */}
        <div className="flex w-full flex-col items-center gap-2">
          {_settingsItem ? (
            <SidebarItem
              icon={_settingsItem.icon ?? AccountSetting01Icon}
              label={_settingsItem.label ?? "Settings"}
              active={_settingsItem.active ?? false}
              expanded={isExpanded}
              {..._settingsItem}
            />
          ) : null}
          {profile ? (
            <SidebarProfile expanded={isExpanded} {...profile} />
          ) : null}
        </div>
      </aside>
    </TooltipProvider>
  )
}
