"use client"

import * as React from "react"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export type SidebarItemProps = Omit<
  React.ComponentProps<typeof Button>,
  "children" | "variant" | "size" | "render" | "nativeButton"
> & {
  icon: IconSvgElement
  label: string
  active?: boolean
  href?: string
  target?: React.ComponentProps<"a">["target"]
  rel?: React.ComponentProps<"a">["rel"]
  expanded?: boolean
}

export function SidebarItem({
  icon,
  label,
  active = false,
  href,
  target,
  rel,
  className,
  title,
  expanded = false,
  ...props
}: SidebarItemProps) {
  const itemClassName = cn(
    "flex items-center rounded-2xl border border-transparent bg-transparent transition-all duration-150 hover:bg-muted/40 hover:text-foreground focus-visible:bg-muted/40 focus-visible:text-foreground",
    active ? "text-foreground font-semibold" : "text-muted-foreground",
    expanded ? "h-12 w-full justify-start gap-3.5 px-3.5" : "size-12 justify-center p-0 mx-auto",
    className
  )

  const iconNode = (
    <HugeiconsIcon
      icon={icon}
      strokeWidth={active ? 2.4 : 1.8}
      className={cn(
        "size-5.5 shrink-0 transition-all duration-150",
        active
          ? "text-foreground scale-110 drop-shadow-xs"
          : "text-muted-foreground hover:text-foreground"
      )}
    />
  )
  const itemTitle = title ?? label

  const buttonElement = href ? (
    <Button
      variant="ghost"
      size={expanded ? "default" : "icon-lg"}
      nativeButton={false}
      render={
        <a
          href={href}
          rel={target === "_blank" && !rel ? "noreferrer noopener" : rel}
          target={target}
        />
      }
      aria-current={active ? "page" : undefined}
      aria-label={label}
      data-active={active}
      className={itemClassName}
      {...props}
    >
      {iconNode}
      {expanded ? (
        <span
          className={cn(
            "truncate text-sm font-medium",
            active && "font-semibold text-foreground"
          )}
        >
          {label}
        </span>
      ) : (
        <span className="sr-only">{label}</span>
      )}
    </Button>
  ) : (
    <Button
      type="button"
      variant="ghost"
      size={expanded ? "default" : "icon-lg"}
      aria-pressed={active}
      aria-label={label}
      data-active={active}
      className={itemClassName}
      {...props}
    >
      {iconNode}
      {expanded ? (
        <span
          className={cn(
            "truncate text-sm font-medium",
            active && "font-semibold text-foreground"
          )}
        >
          {label}
        </span>
      ) : (
        <span className="sr-only">{label}</span>
      )}
    </Button>
  )

  if (expanded) {
    return buttonElement
  }

  return (
    <Tooltip>
      <TooltipTrigger render={buttonElement} />
      <TooltipContent side="right" sideOffset={12}>
        {itemTitle}
      </TooltipContent>
    </Tooltip>
  )
}
