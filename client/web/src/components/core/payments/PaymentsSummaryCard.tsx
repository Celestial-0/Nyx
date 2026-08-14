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
    <Card className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl">
      <CardHeader className="border-b border-border/50 px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <CardTitle className="text-sm font-semibold">Balance</CardTitle>
          <CardDescription className="text-xs">
            Your message spend and recharge rate live here.
          </CardDescription>
        </div>
        <CardAction>
          <Badge variant="secondary" className="px-2 py-0.5 text-xs font-semibold">
            {formatCredits(snapshot.balance)}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-3.5">
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl border border-border/50 bg-background/40 p-2.5">
            <p className="text-[0.7rem] text-muted-foreground">Recharge rate</p>
            <p className="mt-0.5 text-xs font-medium">
              {snapshot.pricing.creditsPerSol.toLocaleString()} / SOL
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-background/40 p-2.5">
            <p className="text-[0.7rem] text-muted-foreground">Starter balance</p>
            <p className="mt-0.5 text-xs font-medium">
              {formatCredits(snapshot.pricing.defaultInitialCredits)}
            </p>
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-1.5 text-xs">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Message send</span>
            <span className="font-medium">{snapshot.pricing.messageSendCredits} credits</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Create group</span>
            <span className="font-medium">{snapshot.pricing.groupRoomCreateCredits} credits</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Network</span>
            <span className="capitalize font-medium">{snapshot.network.chain}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
