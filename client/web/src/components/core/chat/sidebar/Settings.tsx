"use client"

import { Moon02Icon, Sun03Icon, ComputerPhoneSyncIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldTitle,
} from "@/components/ui/field"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useResponsivePanels } from "@/hooks/useResponsivePanels"
import type { UserConfig } from "@/features/user/user.types"

type SettingsSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: UserConfig
  creditBalance: number | null
  onThemeChange: (theme: UserConfig["theme"]) => void
  onConfigChange: (patch: Partial<UserConfig>) => void
  onOpenPayments: () => void
  onSignOut: () => Promise<void> | void
}

export function SettingsSheet({
  open,
  onOpenChange,
  config,
  creditBalance,
  onThemeChange,
  onConfigChange,
  onOpenPayments,
  onSignOut,
}: SettingsSheetProps) {
  const { isMobile } = useResponsivePanels()

  const content = (
    <ScrollArea className="max-h-[min(70vh,720px)]">
      <div className="flex flex-col gap-6 p-6">
        <FieldGroup>
          <Field>
            <FieldContent>
              <FieldTitle>Theme</FieldTitle>
            </FieldContent>
            <ToggleGroup
              aria-label="Theme"
              value={[config.theme]}
              onValueChange={(value) => {
                const nextTheme = value.at(-1)

                if (
                  nextTheme === "dark" ||
                  nextTheme === "light" ||
                  nextTheme === "system"
                ) {
                  onThemeChange(nextTheme)
                }
              }}
              spacing={1}
            >
              <ToggleGroupItem value="dark" aria-label="Dark theme">
                <HugeiconsIcon
                  icon={Moon02Icon}
                  strokeWidth={2}
                  data-icon="inline-start"
                />
                Dark
              </ToggleGroupItem>
              <ToggleGroupItem value="light" aria-label="Light theme">
                <HugeiconsIcon
                  icon={Sun03Icon}
                  strokeWidth={2}
                  data-icon="inline-start"
                />
                Light
              </ToggleGroupItem>
              <ToggleGroupItem value="system" aria-label="System theme">
                <HugeiconsIcon
                  icon={ComputerPhoneSyncIcon}
                  strokeWidth={2}
                  data-icon="inline-start"
                />
                System
              </ToggleGroupItem>
            </ToggleGroup>
          </Field>
        </FieldGroup>

        <Separator />

        <FieldGroup>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldTitle>Notifications</FieldTitle>
              <FieldDescription>
                Keep conversation alerts enabled.
              </FieldDescription>
            </FieldContent>
            <Switch
              checked={config.notifications}
              onCheckedChange={(checked) =>
                onConfigChange({ notifications: checked })
              }
            />
          </Field>

          <Field orientation="horizontal">
            <FieldContent>
              <FieldTitle>Compact mode</FieldTitle>
              <FieldDescription>
                Use a denser chat layout.
              </FieldDescription>
            </FieldContent>
            <Switch
              checked={config.compactMode}
              onCheckedChange={(checked) =>
                onConfigChange({ compactMode: checked })
              }
            />
          </Field>

          <Field orientation="horizontal">
            <FieldContent>
              <FieldTitle>Auto-connect wallet</FieldTitle>
              <FieldDescription>
                Reconnect the last wallet on return.
              </FieldDescription>
            </FieldContent>
            <Switch
              checked={config.autoConnectWallet}
              onCheckedChange={(checked) =>
                onConfigChange({ autoConnectWallet: checked })
              }
            />
          </Field>

          <Field orientation="horizontal">
            <FieldContent>
              <FieldTitle>Share presence</FieldTitle>
              <FieldDescription>
                Let others know when you are online.
              </FieldDescription>
            </FieldContent>
            <Switch
              checked={config.sharePresence}
              onCheckedChange={(checked) =>
                onConfigChange({ sharePresence: checked })
              }
            />
          </Field>
        </FieldGroup>

        <Separator />

        <FieldGroup>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldTitle>Credits</FieldTitle>
              <FieldDescription>
                {creditBalance == null
                  ? "Open your balance and recharge controls."
                  : `${creditBalance.toLocaleString()} credits available.`}
              </FieldDescription>
            </FieldContent>
            <Button type="button" variant="outline" onClick={onOpenPayments}>
              Manage
            </Button>
          </Field>
        </FieldGroup>

        <Separator />

        <Button
          type="button"
          variant="destructive"
          className="w-full rounded-2xl"
          onClick={() => void onSignOut()}
        >
          Sign out
        </Button>
      </div>
    </ScrollArea>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Settings</DrawerTitle>
            <DrawerDescription>
              Personalize your chat workspace and session behavior.
            </DrawerDescription>
          </DrawerHeader>
          {content}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden rounded-3xl border border-border/70 bg-popover/95 p-0">
        <DialogHeader className="border-b border-border/60 px-6 py-5 text-left">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Personalize your chat workspace and session behavior.
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  )
}
