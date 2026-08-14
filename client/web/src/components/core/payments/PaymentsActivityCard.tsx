"use client"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

import type { PaymentCreditsSnapshot } from "@/features/payments/payments.types"

type PaymentsActivityCardProps = {
  snapshot: PaymentCreditsSnapshot
}

function formatWhen(value: string | null) {
  if (!value) {
    return "Just now"
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "Just now"
  }

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatReason(reason: string) {
  if (reason.startsWith("recharge:")) {
    return "Recharge applied"
  }

  switch (reason) {
    case "initial_grant":
      return "Starter credits"
    case "room_creation":
      return "Group created"
    case "message_send":
      return "Message sent"
    case "pending_local_update":
      return "Syncing latest spend"
    default:
      return reason.replace(/_/g, " ")
  }
}

export function PaymentsActivityCard({
  snapshot,
}: PaymentsActivityCardProps) {
  const hasRecharges = snapshot.recentRecharges.length > 0
  const hasActivity = snapshot.recentActivity.length > 0

  return (
    <Card className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl">
      <CardHeader className="border-b border-border/50 px-4 py-3">
        <CardTitle className="text-sm font-semibold">Recent activity</CardTitle>
        <CardDescription className="text-xs">
          Your latest top-ups and credit changes sync here.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-3.5">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-muted-foreground">
                Recharges
              </p>
              {hasRecharges ? (
                <Badge variant="outline" className="text-[0.65rem] px-1.5 py-0">
                  {snapshot.recentRecharges.length}
                </Badge>
              ) : null}
            </div>

            {hasRecharges ? (
              snapshot.recentRecharges.map((recharge) => (
                <div
                  key={recharge.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-border/50 bg-background/35 p-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">
                      {recharge.amountSol} SOL
                    </p>
                    <p className="truncate text-[0.7rem] text-muted-foreground">
                      {recharge.transactionHash.slice(0, 6)}...
                      {recharge.transactionHash.slice(-6)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">
                      +{recharge.creditsGranted}
                    </Badge>
                    <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
                      {formatWhen(recharge.verifiedAt ?? recharge.createdAt)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <Empty className="rounded-xl border border-dashed border-border/50 bg-background/20 py-3">
                <EmptyHeader>
                  <EmptyTitle className="text-xs font-medium">No recharges yet</EmptyTitle>
                  <EmptyDescription className="text-[0.7rem]">
                    Your completed SOL top-ups will appear here.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-muted-foreground">
                Credit ledger
              </p>
              {hasActivity ? (
                <Badge variant="outline" className="text-[0.65rem] px-1.5 py-0">
                  {snapshot.recentActivity.length}
                </Badge>
              ) : null}
            </div>

            {hasActivity ? (
              <ScrollArea className="max-h-48 pr-2">
                <div className="flex flex-col gap-2">
                  {snapshot.recentActivity.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-border/50 bg-background/35 p-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">
                          {formatReason(activity.reason)}
                        </p>
                        <p className="text-[0.7rem] text-muted-foreground">
                          {formatWhen(activity.createdAt)}
                        </p>
                      </div>
                      <Badge
                        variant={activity.change >= 0 ? "secondary" : "outline"}
                        className="text-xs px-1.5 py-0"
                      >
                        {activity.change > 0 ? "+" : ""}
                        {activity.change}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <Empty className="rounded-xl border border-dashed border-border/50 bg-background/20 py-3">
                <EmptyContent>
                  <EmptyHeader>
                    <EmptyTitle className="text-xs font-medium">No spend activity yet</EmptyTitle>
                    <EmptyDescription className="text-[0.7rem]">
                      Message and room charges will show up after you use them.
                    </EmptyDescription>
                  </EmptyHeader>
                </EmptyContent>
              </Empty>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
