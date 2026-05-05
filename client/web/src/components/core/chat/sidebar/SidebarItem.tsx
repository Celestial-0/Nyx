"use client"

import * as React from "react"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"

import { Button } from "@/components/ui/button"
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
  ...props
}: SidebarItemProps) {
  const itemClassName = cn(
    "flex h-12 w-full items-center justify-center gap-0 overflow-hidden rounded-2xl border border-transparent bg-transparent p-0 text-muted-foreground transition-all duration-200 hover:bg-secondary/80 hover:text-foreground focus-visible:bg-secondary/80 focus-visible:text-foreground lg:group-hover/sidebar:justify-start lg:group-hover/sidebar:gap-3 lg:group-hover/sidebar:px-3 lg:group-focus-within/sidebar:justify-start lg:group-focus-within/sidebar:gap-3 lg:group-focus-within/sidebar:px-3 data-[active=true]:border-border/60 data-[active=true]:bg-secondary/90 data-[active=true]:text-foreground",
    className
  )

  const iconNode = (
    <HugeiconsIcon
      icon={icon}
      strokeWidth={active ? 2.2 : 2}
      className="shrink-0"
    />
  )
  const itemTitle = title ?? label

  if (href) {
    const itemRel = target === "_blank" && !rel ? "noreferrer noopener" : rel

    return (
      <Button
        variant="ghost"
        size="icon-lg"
        nativeButton={false}
        render={<a href={href} rel={itemRel} target={target} />}
        aria-current={active ? "page" : undefined}
        aria-label={label}
        data-active={active}
        title={itemTitle}
        className={itemClassName}
        {...props}
      >
        {iconNode}
        <span
          className={cn(
            "pointer-events-none w-0 overflow-hidden whitespace-nowrap text-sm font-medium opacity-0 transition-all duration-200 lg:group-hover/sidebar:w-auto lg:group-hover/sidebar:opacity-100 lg:group-focus-within/sidebar:w-auto lg:group-focus-within/sidebar:opacity-100",
            active && "text-foreground"
          )}
        >
          {label}
        </span>
        <span className="sr-only">{label}</span>
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-lg"
      aria-pressed={active}
      aria-label={label}
      data-active={active}
      title={itemTitle}
      className={itemClassName}
      {...props}
    >
      {iconNode}
      <span
        className={cn(
          "pointer-events-none w-0 overflow-hidden whitespace-nowrap text-sm font-medium opacity-0 transition-all duration-200 lg:group-hover/sidebar:w-auto lg:group-hover/sidebar:opacity-100 lg:group-focus-within/sidebar:w-auto lg:group-focus-within/sidebar:opacity-100",
          active && "text-foreground"
        )}
      >
        {label}
      </span>
      <span className="sr-only">{label}</span>
    </Button>
  )
}
