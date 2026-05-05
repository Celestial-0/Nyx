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
    <Card className="rounded-3xl border border-border/70 bg-card/70 backdrop-blur-xl">
      <CardHeader className="border-b border-border/60 pb-4">
        <CardTitle>Recent activity</CardTitle>
        <CardDescription>
          Your latest top-ups and credit changes sync here.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-muted-foreground">
                Recharges
              </p>
              {hasRecharges ? (
                <Badge variant="outline">
                  {snapshot.recentRecharges.length}
                </Badge>
              ) : null}
            </div>

            {hasRecharges ? (
              snapshot.recentRecharges.map((recharge) => (
                <div
                  key={recharge.id}
                  className="flex items-start justify-between gap-4 rounded-2xl border border-border/60 bg-background/35 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {recharge.amountSol} SOL
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {recharge.transactionHash.slice(0, 8)}...
                      {recharge.transactionHash.slice(-8)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge variant="secondary">
                      +{recharge.creditsGranted}
                    </Badge>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatWhen(recharge.verifiedAt ?? recharge.createdAt)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <Empty className="rounded-2xl border border-dashed border-border/60 bg-background/25">
                <EmptyHeader>
                  <EmptyTitle>No recharges yet</EmptyTitle>
                  <EmptyDescription>
                    Your completed SOL top-ups will appear here.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>

          <Separator />

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-muted-foreground">
                Credit ledger
              </p>
              {hasActivity ? (
                <Badge variant="outline">{snapshot.recentActivity.length}</Badge>
              ) : null}
            </div>

            {hasActivity ? (
              <ScrollArea className="max-h-64 pr-2">
                <div className="flex flex-col gap-3">
                  {snapshot.recentActivity.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start justify-between gap-4 rounded-2xl border border-border/60 bg-background/35 p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {formatReason(activity.reason)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatWhen(activity.createdAt)}
                        </p>
                      </div>
                      <Badge
                        variant={activity.change >= 0 ? "secondary" : "outline"}
                      >
                        {activity.change > 0 ? "+" : ""}
                        {activity.change}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <Empty className="rounded-2xl border border-dashed border-border/60 bg-background/25">
                <EmptyContent>
                  <EmptyHeader>
                    <EmptyTitle>No spend activity yet</EmptyTitle>
                    <EmptyDescription>
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
