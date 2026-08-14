"use client"

import { useEffect, useMemo, useState } from "react"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { toast } from "sonner"

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
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useResponsivePanels } from "@/hooks/useResponsivePanels"
import { useAuthStore } from "@/features/auth/auth.store"
import {
  applyRechargeResultAction,
  loadPaymentsSnapshotAction,
  usePaymentsPanel,
  verifyRechargeTransactionAction,
} from "@/features/payments/payments.hooks"
import {
  parseSolAmountToLamports,
  sendSolRechargeTransaction,
} from "@/features/payments/payments.solana"
import { usePaymentsStore } from "@/features/payments/payments.store"

import { PaymentsActivityCard } from "./PaymentsActivityCard"
import { PaymentsRechargeCard } from "./PaymentsRechargeCard"
import { PaymentsSummaryCard } from "./PaymentsSummaryCard"

function getSuccessMessage(input: {
  creditsGranted: number
  amountSol: string
}) {
  return `${input.creditsGranted.toLocaleString()} credits were added from ${input.amountSol} SOL.`
}

export function PaymentsDialog() {
  const { isMobile } = useResponsivePanels()
  const { connection } = useConnection()
  const { connected, publicKey, sendTransaction } = useWallet()
  const authUser = useAuthStore((state) => state.user)
  const {
    isOpen,
    recoveryMessage,
    snapshot,
    status,
    error,
    rechargeState,
    rechargeError,
    lastRecharge,
    close,
  } = usePaymentsPanel()

  const setRechargeState = usePaymentsStore((state) => state.setRechargeState)
  const setRechargeError = usePaymentsStore((state) => state.setRechargeError)
  const [selectedPreset, setSelectedPreset] = useState("0.25")
  const [amount, setAmount] = useState("0.25")

  useEffect(() => {
    if (isOpen && !snapshot && status !== "loading") {
      void loadPaymentsSnapshotAction().catch(() => undefined)
    }
  }, [isOpen, snapshot, status])

  const walletMismatch =
    authUser != null &&
    publicKey != null &&
    publicKey.toBase58() !== authUser.walletAddress

  const isBusy = rechargeState === "sending" || rechargeState === "verifying"

  const successMessage = useMemo(
    () =>
      lastRecharge
        ? getSuccessMessage({
            creditsGranted: lastRecharge.creditsGranted,
            amountSol: lastRecharge.amountSol,
          })
        : null,
    [lastRecharge]
  )

  const handleCopyTreasury = async () => {
    if (!snapshot?.treasury.walletAddress) {
      return
    }

    try {
      await navigator.clipboard.writeText(snapshot.treasury.walletAddress)
      toast.success("Treasury wallet copied.")
    } catch {
      toast.error("Unable to copy the treasury wallet.")
    }
  }

  const handleRecharge = async () => {
    if (!snapshot) {
      toast.error("Credits are still loading.")
      return
    }

    if (!authUser || !connected || !publicKey || !sendTransaction) {
      toast.error("Reconnect your wallet before sending SOL.")
      return
    }

    if (walletMismatch) {
      toast.error("Use the same wallet that is signed into Nyx.")
      return
    }

    try {
      const amountLamports = parseSolAmountToLamports(amount)
      setRechargeState("sending")
      setRechargeError(null)

      const transactionHash = await sendSolRechargeTransaction({
        connection,
        walletAddress: publicKey.toBase58(),
        treasuryWalletAddress: snapshot.treasury.walletAddress,
        amountLamports,
        sendTransaction,
      })

      const recharge = await verifyRechargeTransactionAction(transactionHash)
      applyRechargeResultAction(recharge)
      toast.success("Recharge verified.")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Recharge failed."
      setRechargeState("error")
      setRechargeError(message)
      toast.error(message)
    }
  }

  const content = (
    <ScrollArea className="max-h-[min(72vh,580px)]">
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        {status === "loading" && !snapshot ? (
          <Empty className="rounded-2xl border border-dashed border-border/60 bg-card/40 py-8">
            <EmptyHeader>
              <EmptyTitle className="text-sm font-medium">Loading credits</EmptyTitle>
              <EmptyDescription className="text-xs">
                Pulling your balance and recharge history.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}

        {status === "error" && !snapshot ? (
          <Empty className="rounded-2xl border border-dashed border-border/60 bg-card/40 py-8">
            <EmptyHeader>
              <EmptyTitle className="text-sm font-medium text-destructive">
                Credits unavailable
              </EmptyTitle>
              <EmptyDescription className="text-xs">
                {error ?? "Unable to load your current balance."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}

        {snapshot ? (
          <>
            <PaymentsSummaryCard snapshot={snapshot} />
            <PaymentsRechargeCard
              snapshot={snapshot}
              amount={amount}
              selectedPreset={selectedPreset}
              onPresetChange={(value) => {
                setSelectedPreset(value)
                setAmount(value)
              }}
              onAmountChange={(value) => {
                setAmount(value)
                setSelectedPreset(["0.10", "0.25", "0.50", "1.00"].includes(value) ? value : "")
              }}
              onCopyTreasury={() => {
                void handleCopyTreasury()
              }}
              onRecharge={() => {
                void handleRecharge()
              }}
              disabled={walletMismatch || !connected}
              isBusy={isBusy}
              recoveryMessage={recoveryMessage}
              error={rechargeError}
              successMessage={successMessage}
            />
            <PaymentsActivityCard snapshot={snapshot} />
          </>
        ) : null}
      </div>
    </ScrollArea>
  )

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && close()}>
        <DrawerContent className="mx-auto max-w-lg rounded-t-3xl border-t border-border/70 bg-popover/95 backdrop-blur-xl p-0">
          <DrawerHeader className="border-b border-border/60 px-5 py-4 text-left">
            <DrawerTitle className="text-base font-semibold">Credits</DrawerTitle>
            <DrawerDescription className="text-xs">
              Recharge your balance without leaving the chat workspace.
            </DrawerDescription>
          </DrawerHeader>
          {content}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-md md:max-w-lg overflow-hidden rounded-3xl border border-border/70 bg-popover/95 backdrop-blur-xl p-0 shadow-2xl">
        <DialogHeader className="border-b border-border/60 px-5 py-4 text-left">
          <DialogTitle className="text-base font-semibold">Credits</DialogTitle>
          <DialogDescription className="text-xs">
            Recharge your balance without leaving the chat workspace.
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  )
}
