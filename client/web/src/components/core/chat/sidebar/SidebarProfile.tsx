"use client"

import * as React from "react"
import {
  ArrowRight01Icon,
  AccountSetting01Icon,
  ContactIcon,
  Rocket01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"

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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
  expanded?: boolean
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
  expanded = false,
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
    "relative flex items-center rounded-2xl border border-transparent bg-background/50 backdrop-blur-md transition-all duration-150 hover:bg-secondary/80 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary/20",
    expanded ? "h-12 w-full justify-start gap-3 px-3" : "size-12 justify-center p-0 mx-auto",
    className
  )

  const content = (
    <div
      className={cn(
        "flex w-full items-center overflow-hidden",
        expanded ? "justify-start gap-3" : "justify-center"
      )}
    >
      <div className="relative shrink-0">
        <Avatar className="size-9 after:border-transparent">
          <AvatarImage src={imageSrc} alt={name} />
          <AvatarFallback className="text-xs font-medium">
            {fallback}
          </AvatarFallback>
        </Avatar>

        <span
          className={cn(
            "absolute right-0 bottom-0 size-2.5 rounded-full ring-2 ring-background",
            statusClassNames[status]
          )}
        />
      </div>

      {expanded && (
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-medium text-foreground">{name}</p>
          <p className="truncate text-[0.7rem] text-muted-foreground">
            {statusLabels[status]}
          </p>
        </div>
      )}

      <span className="sr-only">{profileTitle}</span>
    </div>
  )

  const triggerButton = (
    <DropdownMenuTrigger
      render={
        <Button
          variant="ghost"
          size={expanded ? "default" : "icon-lg"}
          className={profileClassName}
          aria-label={profileTitle}
          {...props}
        />
      }
    >
      {content}
    </DropdownMenuTrigger>
  )

  return (
    <DropdownMenu>
      {expanded ? (
        triggerButton
      ) : (
        <Tooltip>
          <TooltipTrigger render={triggerButton} />
          <TooltipContent side="right" sideOffset={12}>
            {profileTitle}
          </TooltipContent>
        </Tooltip>
      )}

      <DropdownMenuContent
        align={expanded ? "start" : "center"}
        side="top"
        sideOffset={8}
        className={cn(
          "w-56 rounded-2xl",
          "border border-border/50 bg-background/95 backdrop-blur-xl",
          "shadow-lg p-1.5"
        )}
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2.5 py-2">
            <div className="flex items-center gap-3">
              <Avatar className="size-8 after:border-transparent">
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
                "rounded-xl px-2.5 py-2 text-sm",
                "transition-colors duration-150",
                "hover:bg-muted/50"
              )}
              render={
                item.href ? (
                  <a href={item.href} target={item.target} rel={rel} />
                ) : undefined
              }
            >
              <span className="flex w-full items-center gap-2.5">
                {item.icon && (
                  <HugeiconsIcon
                    icon={item.icon}
                    strokeWidth={1.8}
                    className="text-muted-foreground size-4.5"
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
