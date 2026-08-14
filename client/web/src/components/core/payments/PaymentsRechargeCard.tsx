"use client"

import { Copy01Icon, Rocket01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

import type { PaymentCreditsSnapshot } from "@/features/payments/payments.types"

type PaymentsRechargeCardProps = {
  snapshot: PaymentCreditsSnapshot
  amount: string
  selectedPreset: string
  onPresetChange: (value: string) => void
  onAmountChange: (value: string) => void
  onCopyTreasury: () => void
  onRecharge: () => void
  disabled?: boolean
  isBusy?: boolean
  recoveryMessage?: string | null
  error?: string | null
  successMessage?: string | null
}

const presets = ["0.10", "0.25", "0.50", "1.00"]

function getEstimatedCredits(amount: string, creditsPerSol: number) {
  const parsed = Number(amount)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0
  }

  return Math.floor(parsed * creditsPerSol)
}

export function PaymentsRechargeCard({
  snapshot,
  amount,
  selectedPreset,
  onPresetChange,
  onAmountChange,
  onCopyTreasury,
  onRecharge,
  disabled,
  isBusy,
  recoveryMessage,
  error,
  successMessage,
}: PaymentsRechargeCardProps) {
  const estimatedCredits = getEstimatedCredits(
    amount,
    snapshot.pricing.creditsPerSol
  )

  return (
    <Card className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl">
      <CardHeader className="border-b border-border/50 px-4 py-3">
        <CardTitle className="text-sm font-semibold">Recharge</CardTitle>
        <CardDescription className="text-xs">
          Send native SOL to the treasury wallet, then verify the signature.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 p-3.5">
        {recoveryMessage ? (
          <Alert className="rounded-xl border-border/60 bg-background/35 py-2">
            <HugeiconsIcon icon={Rocket01Icon} strokeWidth={1.8} className="size-4" />
            <AlertTitle className="text-xs font-medium">Credits needed</AlertTitle>
            <AlertDescription className="text-xs">{recoveryMessage}</AlertDescription>
          </Alert>
        ) : null}

        {successMessage ? (
          <Alert className="rounded-xl border-border/60 bg-background/35 py-2">
            <HugeiconsIcon icon={Rocket01Icon} strokeWidth={1.8} className="size-4" />
            <AlertTitle className="text-xs font-medium">Recharge confirmed</AlertTitle>
            <AlertDescription className="text-xs">{successMessage}</AlertDescription>
          </Alert>
        ) : null}

        {error ? (
          <Alert
            variant="destructive"
            className="rounded-xl border-destructive/30 py-2"
          >
            <AlertTitle className="text-xs font-medium">Unable to recharge</AlertTitle>
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        ) : null}

        <FieldGroup className="gap-3">
          <Field className="gap-1.5">
            <FieldContent>
              <FieldTitle className="text-xs font-medium">Preset amount</FieldTitle>
              <FieldDescription className="text-[0.7rem]">
                Pick a quick amount or enter a custom SOL value below.
              </FieldDescription>
            </FieldContent>
            <ToggleGroup
              aria-label="Recharge amount presets"
              value={selectedPreset ? [selectedPreset] : []}
              onValueChange={(value) => {
                const nextValue = value.at(-1)

                if (nextValue) {
                  onPresetChange(nextValue)
                }
              }}
              spacing={1}
            >
              {presets.map((preset) => (
                <ToggleGroupItem key={preset} value={preset} className="h-8 px-2.5 text-xs">
                  {preset} SOL
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>

          <Field className="gap-1.5">
            <FieldContent>
              <FieldTitle className="text-xs font-medium">Custom amount</FieldTitle>
            </FieldContent>
            <Input
              inputMode="decimal"
              placeholder="0.25"
              value={amount}
              className="h-8 text-xs"
              onChange={(event) => onAmountChange(event.target.value)}
            />
          </Field>
        </FieldGroup>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl border border-border/50 bg-background/35 p-2.5">
            <p className="text-[0.7rem] text-muted-foreground">Estimated credits</p>
            <p className="mt-0.5 text-xs font-medium">
              {estimatedCredits.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-background/35 p-2.5">
            <p className="text-[0.7rem] text-muted-foreground">Network</p>
            <p className="mt-0.5 truncate text-xs font-medium capitalize">
              {snapshot.network.chain}
            </p>
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">Treasury wallet</span>
            <Button type="button" variant="outline" size="xs" onClick={onCopyTreasury} className="h-6 px-2 text-[0.7rem]">
              <HugeiconsIcon
                icon={Copy01Icon}
                strokeWidth={1.8}
                data-icon="inline-start"
                className="size-3"
              />
              Copy
            </Button>
          </div>

          <div className="rounded-xl border border-border/50 bg-background/35 px-2.5 py-1.5">
            <p className="truncate font-mono text-[0.7rem] text-muted-foreground">
              {snapshot.treasury.walletAddress}
            </p>
          </div>
        </div>
      </CardContent>

      <CardFooter className="border-t border-border/50 px-4 py-3">
        <Button
          type="button"
          className="h-9 w-full rounded-xl text-xs font-medium"
          disabled={disabled || isBusy}
          onClick={onRecharge}
        >
          {isBusy ? <Spinner data-icon="inline-start" className="size-3.5" /> : null}
          Send SOL and verify
        </Button>
      </CardFooter>
    </Card>
  )
}
