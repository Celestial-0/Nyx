import { useCallback, useEffect } from "react"

import { getAuthenticatedAccessToken } from "@/features/auth/auth.hooks"
import { useAuthStore } from "@/features/auth/auth.store"

import {
  getPaymentsSnapshot,
  verifyPaymentsRecharge,
} from "./payments.api"
import { usePaymentsStore } from "./payments.store"
import type {
  PaymentsPanelSource,
  PaymentRechargeVerifyResponse,
} from "./payments.types"

async function requireAccessToken() {
  return getAuthenticatedAccessToken()
}

export async function loadPaymentsSnapshotAction(options?: {
  background?: boolean
}) {
  const payments = usePaymentsStore.getState()
  const isBackground = options?.background === true

  if (!isBackground) {
    payments.setStatus("loading")
  }

  payments.setError(null)

  try {
    const accessToken = await requireAccessToken()
    const snapshot = await getPaymentsSnapshot(accessToken)
    payments.setSnapshot(snapshot)
    return snapshot
  } catch (error) {
    if (!isBackground) {
      payments.setStatus("error")
      payments.setError(
        error instanceof Error
          ? error.message
          : "Unable to load your credits right now."
      )
    }

    throw error
  }
}

export function openPaymentsPanelAction(input?: {
  source?: PaymentsPanelSource | null
  recoveryMessage?: string | null
}) {
  const payments = usePaymentsStore.getState()

  payments.openPanel(input)

  if (payments.status === "idle") {
    void loadPaymentsSnapshotAction().catch(() => undefined)
  }
}

export function closePaymentsPanelAction() {
  usePaymentsStore.getState().closePanel()
}

export async function verifyRechargeTransactionAction(transactionHash: string) {
  const payments = usePaymentsStore.getState()
  payments.setRechargeState("verifying")
  payments.setRechargeError(null)

  try {
    const accessToken = await requireAccessToken()
    const response = await verifyPaymentsRecharge(transactionHash, accessToken)

    payments.setLastRecharge(response)
    payments.setRechargeState("success")

    await loadPaymentsSnapshotAction({ background: true })

    return response
  } catch (error) {
    payments.setRechargeState("error")
    payments.setRechargeError(
      error instanceof Error ? error.message : "Unable to verify this recharge."
    )
    throw error
  }
}

export function applyLocalDebitAction(input: { credits: number }) {
  usePaymentsStore.getState().patchSnapshot((snapshot) => ({
    ...snapshot,
    balance: Math.max(0, snapshot.balance - input.credits),
    recentActivity: [
      {
        id: `local-${Date.now()}`,
        change: -input.credits,
        reason: "pending_local_update",
        createdAt: new Date().toISOString(),
      },
      ...snapshot.recentActivity,
    ].slice(0, 8),
  }))
}

export function applyRechargeResultAction(recharge: PaymentRechargeVerifyResponse) {
  usePaymentsStore.getState().patchSnapshot((snapshot) => ({
    ...snapshot,
    balance: recharge.balance,
    recentRecharges: [
      {
        id: `local-${recharge.transactionHash}`,
        transactionHash: recharge.transactionHash,
        amountSol: recharge.amountSol,
        creditsGranted: recharge.creditsGranted,
        status: recharge.status,
        network: snapshot.network.chain,
        verifiedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      ...snapshot.recentRecharges,
    ].slice(0, 5),
  }))
}

export function usePaymentsPanel() {
  const isOpen = usePaymentsStore((state) => state.isOpen)
  const openSource = usePaymentsStore((state) => state.openSource)
  const recoveryMessage = usePaymentsStore((state) => state.recoveryMessage)
  const snapshot = usePaymentsStore((state) => state.snapshot)
  const status = usePaymentsStore((state) => state.status)
  const error = usePaymentsStore((state) => state.error)
  const rechargeState = usePaymentsStore((state) => state.rechargeState)
  const rechargeError = usePaymentsStore((state) => state.rechargeError)
  const lastRecharge = usePaymentsStore((state) => state.lastRecharge)
  const authStatus = useAuthStore((state) => state.status)

  useEffect(() => {
    if (authStatus !== "authenticated") {
      usePaymentsStore.getState().reset()
    }
  }, [authStatus])

  const open = useCallback(
    (input?: {
      source?: PaymentsPanelSource | null
      recoveryMessage?: string | null
    }) => {
      openPaymentsPanelAction(input)
    },
    []
  )

  const close = useCallback(() => {
    closePaymentsPanelAction()
  }, [])

  const refresh = useCallback(async () => {
    return loadPaymentsSnapshotAction()
  }, [])

  return {
    isOpen,
    openSource,
    recoveryMessage,
    snapshot,
    status,
    error,
    rechargeState,
    rechargeError,
    lastRecharge,
    open,
    close,
    refresh,
  }
}
