"use client"

import type { ReactNode } from "react"
import {
  AccountSetting01Icon,
  BellDotIcon,
  BubbleChatIcon,
  ContactIcon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"

import { cn } from "@/lib/utils"

import { SidebarItem, type SidebarItemProps } from "./SidebarItem"
import { SidebarProfile, type SidebarProfileProps } from "./SidebarProfile"
import { motion } from "motion/react"

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
}: SidebarProps) {
  return (
    <aside
      className={cn(
        "peer/sidebar group/sidebar fixed inset-y-0 left-0 z-30 flex h-screen w-16 flex-col justify-between overflow-hidden border-r border-border/60 bg-background/80 px-3 py-4 backdrop-blur-xl transition-[width] duration-300 ease-out sm:w-20 lg:hover:w-64 lg:focus-within:w-64",
        className
      )}
    >
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="flex items-center gap-0 overflow-hidden p-1"
      >
        <img
          src="/nyx.png"
          alt="Nyx"
          className="h-11 w-11 rounded-2xl border border-border/50 bg-card/70 object-contain p-1.5 shadow-sm sm:h-12 sm:w-12"
        />
        <div className="w-0 overflow-hidden opacity-0 transition-all duration-200 lg:group-hover/sidebar:w-auto lg:group-hover/sidebar:opacity-100 lg:group-focus-within/sidebar:w-auto lg:group-focus-within/sidebar:opacity-100 pl-4">
          <p className="text-sm font-semibold tracking-tight text-foreground ">
            Nyx
          </p>
          <p className="text-xs text-muted-foreground">Messages</p>
        </div>
      </motion.div>

      <nav
        aria-label="Chat sidebar"
        className="flex flex-1 items-center justify-center py-6"
      >
        <div className="flex w-full flex-col items-center gap-2">
          {items.map(({ id, active, match, ...item }) => (
            <SidebarItem
              key={id}
              active={active ?? matchesPath(pathname, item.href, match)}
              {...item}
            />
          ))}
        </div>
      </nav>

      <div className="flex w-full flex-col items-center gap-2">
        {_settingsItem ? (
          <SidebarItem
            icon={_settingsItem.icon ?? AccountSetting01Icon}
            label={_settingsItem.label ?? "Settings"}
            active={false}
            {..._settingsItem}
          />
        ) : null}
        {profile ? <SidebarProfile {...profile} /> : null}
      </div>
    </aside>
  )
}
