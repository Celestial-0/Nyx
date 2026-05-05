"use client"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

import type { PaymentCreditsSnapshot } from "@/features/payments/payments.types"

type PaymentsSummaryCardProps = {
  snapshot: PaymentCreditsSnapshot
}

function formatCredits(value: number) {
  return `${value.toLocaleString()} credits`
}

export function PaymentsSummaryCard({
  snapshot,
}: PaymentsSummaryCardProps) {
  return (
    <Card className="rounded-3xl border border-border/70 bg-card/70 backdrop-blur-xl">
      <CardHeader className="border-b border-border/60 pb-4">
        <div className="flex flex-col gap-1">
          <CardTitle>Balance</CardTitle>
          <CardDescription>
            Your message spend and recharge rate live here.
          </CardDescription>
        </div>
        <CardAction>
          <Badge variant="secondary">{formatCredits(snapshot.balance)}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border/60 bg-background/40 p-3">
            <p className="text-xs text-muted-foreground">Recharge rate</p>
            <p className="mt-1 text-sm font-medium">
              {snapshot.pricing.creditsPerSol.toLocaleString()} / SOL
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/40 p-3">
            <p className="text-xs text-muted-foreground">Starter balance</p>
            <p className="mt-1 text-sm font-medium">
              {formatCredits(snapshot.pricing.defaultInitialCredits)}
            </p>
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Message send</span>
            <span>{snapshot.pricing.messageSendCredits} credits</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Create group</span>
            <span>{snapshot.pricing.groupRoomCreateCredits} credits</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Network</span>
            <span className="capitalize">{snapshot.network.chain}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
