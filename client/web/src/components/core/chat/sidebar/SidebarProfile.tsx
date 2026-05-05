"use client"

import * as React from "react"
import {
  ArrowRight01Icon,
  AccountSetting01Icon,
  ContactIcon,
  Rocket01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { motion } from "motion/react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

const statusClassNames = {
  online: "bg-green-500",
  away: "bg-yellow-500",
  busy: "bg-red-500",
  offline: "bg-zinc-400",
} as const

const statusLabels = {
  online: "Online",
  away: "Away",
  busy: "Do not disturb",
  offline: "Offline",
} as const

export type SidebarProfileMenuItem = {
  id: string
  label: string
  href?: string
  target?: React.ComponentProps<"a">["target"]
  rel?: React.ComponentProps<"a">["rel"]
  icon?: IconSvgElement
  disabled?: boolean
  onSelect?: () => void
}

export type SidebarProfileProps = {
  name: string
  imageSrc?: string
  initials?: string
  status?: keyof typeof statusClassNames
  href?: string
  target?: React.ComponentProps<"a">["target"]
  rel?: React.ComponentProps<"a">["rel"]
  menuItems?: SidebarProfileMenuItem[] | null
} & Omit<
  React.ComponentProps<typeof Button>,
  "children" | "variant" | "size" | "render" | "nativeButton"
>

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("")
}

export function SidebarProfile({
  name,
  imageSrc,
  initials,
  status = "online",
  href,
  target,
  rel,
  menuItems,
  className,
  title,
  ...props
}: SidebarProfileProps) {
  const fallback = initials ?? getInitials(name)
  const profileTitle = title ?? `${name} · ${statusLabels[status]}`

  const defaultMenuItems: SidebarProfileMenuItem[] = [
    {
      id: "profile",
      label: "Profile",
      href: href ?? "/profile",
      target,
      rel,
      icon: ContactIcon,
    },
    {
      id: "settings",
      label: "Settings",
      href: "/settings",
      icon: AccountSetting01Icon,
    },
    {
      id: "credits",
      label: "Credits",
      icon: Rocket01Icon,
    },
  ]

  const items = menuItems ?? defaultMenuItems
  const profileClassName = cn(
    "relative flex h-12 w-full items-center justify-center gap-0 overflow-hidden rounded-2xl p-0 lg:group-hover/sidebar:justify-start lg:group-hover/sidebar:gap-3 lg:group-focus-within/sidebar:justify-start lg:group-focus-within/sidebar:gap-3",
    "bg-background/60 backdrop-blur-md",
    "transition-all duration-200",
    "hover:bg-muted/40",
    "active:scale-[0.97]",
    "focus-visible:ring-2 focus-visible:ring-primary/20",
    className
  )

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex w-full items-center justify-center gap-0 overflow-hidden px-0 lg:group-hover/sidebar:justify-start lg:group-hover/sidebar:gap-3 lg:group-hover/sidebar:px-3 lg:group-focus-within/sidebar:justify-start lg:group-focus-within/sidebar:gap-3 lg:group-focus-within/sidebar:px-3"
    >
      <div className="relative shrink-0">
        <Avatar className="after:border-transparent">
          <AvatarImage src={imageSrc} alt={name} />
          <AvatarFallback className="text-xs font-medium">{fallback}</AvatarFallback>
        </Avatar>

        <span
          className={cn(
            "absolute right-0 bottom-0 size-2.5 rounded-full ring-2 ring-background",
            statusClassNames[status]
          )}
        />
      </div>

      <div className="w-0 overflow-hidden opacity-0 transition-all duration-200 lg:group-hover/sidebar:w-auto lg:group-hover/sidebar:opacity-100 lg:group-focus-within/sidebar:w-auto lg:group-focus-within/sidebar:opacity-100">
        <p className="truncate text-sm font-medium text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground">{statusLabels[status]}</p>
      </div>

      <span className="sr-only">{profileTitle}</span>
    </motion.div>
  )

  const triggerContent = (
    <>
      {content}
      <span className="sr-only">{profileTitle}</span>
    </>
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-lg" className={profileClassName} />
        }
        aria-label={profileTitle}
        title={profileTitle}
        {...props}
      >
        {triggerContent}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="center"
        side="top"
        sideOffset={8}
        className={cn(
          "w-52 rounded-xl",
          "border border-border/50 bg-background/95 backdrop-blur-xl",
          "shadow-lg p-1"
        )}
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-2">
            <div className="flex items-center gap-2.5">
              <Avatar className="size-7 after:border-transparent">
                <AvatarImage src={imageSrc} />
                <AvatarFallback>{fallback}</AvatarFallback>
              </Avatar>

              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {statusLabels[status]}
                </p>
              </div>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {items.map((item) => {
          const rel =
            item.target === "_blank" ? "noreferrer noopener" : item.rel

          return (
            <DropdownMenuItem
              key={item.id}
              disabled={item.disabled}
              onClick={item.onSelect}
              className={cn(
                "rounded-md px-2 py-1.5 text-sm",
                "transition-colors duration-150",
                "hover:bg-muted/50"
              )}
              render={
                item.href ? (
                  <a href={item.href} target={item.target} rel={rel} />
                ) : undefined
              }
            >
              <span className="flex w-full items-center gap-2">
                {item.icon && (
                  <HugeiconsIcon
                    icon={item.icon}
                    strokeWidth={1.8}
                    className="text-muted-foreground"
                  />
                )}
                <span className="flex-1">{item.label}</span>
                {item.href ? (
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    strokeWidth={1.8}
                    className="size-3.5 text-muted-foreground/70"
                  />
                ) : null}
              </span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
