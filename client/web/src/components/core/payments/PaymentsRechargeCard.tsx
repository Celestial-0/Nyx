"use client"

import { Copy01Icon, Rocket01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
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
    <Card className="rounded-3xl border border-border/70 bg-card/70 backdrop-blur-xl">
      <CardHeader className="border-b border-border/60 pb-4">
        <CardTitle>Recharge</CardTitle>
        <CardDescription>
          Send native SOL to the treasury wallet, then verify the signature.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 pt-4">
        {recoveryMessage ? (
          <Alert className="rounded-2xl border-border/60 bg-background/35">
            <HugeiconsIcon icon={Rocket01Icon} strokeWidth={1.8} />
            <AlertTitle>Credits needed</AlertTitle>
            <AlertDescription>{recoveryMessage}</AlertDescription>
          </Alert>
        ) : null}

        {successMessage ? (
          <Alert className="rounded-2xl border-border/60 bg-background/35">
            <HugeiconsIcon icon={Rocket01Icon} strokeWidth={1.8} />
            <AlertTitle>Recharge confirmed</AlertTitle>
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        ) : null}

        {error ? (
          <Alert
            variant="destructive"
            className="rounded-2xl border-destructive/30"
          >
            <AlertTitle>Unable to recharge</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <FieldGroup>
          <Field>
            <FieldContent>
              <FieldTitle>Preset amount</FieldTitle>
              <FieldDescription>
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
                <ToggleGroupItem key={preset} value={preset}>
                  {preset} SOL
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>

          <Field>
            <FieldContent>
              <FieldTitle>Custom amount</FieldTitle>
              <FieldDescription>
                Up to 9 decimals. Credits are integer-based on verification.
              </FieldDescription>
            </FieldContent>
            <Input
              inputMode="decimal"
              placeholder="0.25"
              value={amount}
              onChange={(event) => onAmountChange(event.target.value)}
            />
          </Field>
        </FieldGroup>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border/60 bg-background/35 p-3">
            <p className="text-xs text-muted-foreground">Estimated credits</p>
            <p className="mt-1 text-sm font-medium">
              {estimatedCredits.toLocaleString()}
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/35 p-3">
            <p className="text-xs text-muted-foreground">Wallet destination</p>
            <p className="mt-1 truncate text-sm font-medium">
              {snapshot.treasury.walletAddress}
            </p>
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Treasury wallet</span>
            <Button type="button" variant="outline" size="sm" onClick={onCopyTreasury}>
              <HugeiconsIcon
                icon={Copy01Icon}
                strokeWidth={1.8}
                data-icon="inline-start"
              />
              Copy
            </Button>
          </div>

          <div className="rounded-2xl border border-border/60 bg-background/35 px-3 py-2">
            <p className="truncate font-mono text-xs text-muted-foreground">
              {snapshot.treasury.walletAddress}
            </p>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Network</span>
            <Badge variant="outline">
              {snapshot.network.chain} / {snapshot.network.commitment}
            </Badge>
          </div>
        </div>
      </CardContent>

      <CardFooter className="border-t border-border/60 pt-4">
        <Button
          type="button"
          className="w-full rounded-2xl"
          disabled={disabled || isBusy}
          onClick={onRecharge}
        >
          {isBusy ? <Spinner data-icon="inline-start" /> : null}
          Send SOL and verify
        </Button>
      </CardFooter>
    </Card>
  )
}
