import { useMemo, useReducer, useCallback, useEffect, useState } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { WalletReadyState, type WalletName } from "@solana/wallet-adapter-base"
import bs58 from "bs58"

import { getOrCreateAuthDeviceRegistration } from "@/features/auth/auth.device"
import { requestNonce, useWalletAuth } from "@/features/auth/auth.hooks"
import type { VerifyResponse } from "@/features/auth/auth.types"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"

type AuthState =
  | { value: "idle" }
  | { value: "connecting" }
  | { value: "signing" }
  | { value: "verifying" }
  | { value: "success"; data: VerifyResponse }
  | { value: "error"; error: string }

type AuthEvent =
  | { type: "CONNECT" }
  | { type: "SIGN" }
  | { type: "VERIFY" }
  | { type: "SUCCESS"; data: VerifyResponse }
  | { type: "ERROR"; error: string }
  | { type: "RESET" }

function reducer(state: AuthState, event: AuthEvent): AuthState {
  switch (state.value) {
    case "idle":
      if (event.type === "CONNECT") return { value: "connecting" }
      return state

    case "connecting":
      if (event.type === "SIGN") return { value: "signing" }
      if (event.type === "ERROR") return { value: "error", error: event.error }
      return state

    case "signing":
      if (event.type === "VERIFY") return { value: "verifying" }
      if (event.type === "ERROR") return { value: "error", error: event.error }
      return state

    case "verifying":
      if (event.type === "SUCCESS")
        return { value: "success", data: event.data }
      if (event.type === "ERROR") return { value: "error", error: event.error }
      return state

    case "success":
    case "error":
      if (event.type === "RESET") return { value: "idle" }
      return state

    default:
      return state
  }
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSignedIn?: (data: VerifyResponse) => void
}

export function WalletAuth({ open, onOpenChange, onSignedIn }: Props) {
  const {
    publicKey,
    connect,
    connected,
    wallet,
    disconnect,
    signMessage,
    wallets,
    select,
  } = useWallet()

  const { signIn } = useWalletAuth()

  const [machine, send] = useReducer(reducer, { value: "idle" })
  const [pendingWalletName, setPendingWalletName] = useState<WalletName | null>(
    null
  )

  const walletAddress = useMemo(
    () => publicKey?.toBase58() ?? null,
    [publicKey]
  )

  const availableWallets = useMemo(() => {
    return wallets.filter(
      (wallet) =>
        wallet.readyState === WalletReadyState.Installed ||
        wallet.readyState === WalletReadyState.Loadable
    )
  }, [wallets])

  const handleConnect = useCallback(
    async (walletName?: WalletName) => {
      try {
        send({ type: "CONNECT" })

        if (connected) {
          return
        }

        const selected =
          availableWallets.find((item) => item.adapter.name === walletName) ??
          availableWallets[0]

        if (!selected) throw new Error("No wallet found")

        setPendingWalletName(selected.adapter.name)
        select(selected.adapter.name)
      } catch (error) {
        send({
          type: "ERROR",
          error: error instanceof Error ? error.message : "Connect failed",
        })
      }
    },
    [availableWallets, connected, select]
  )

  useEffect(() => {
    if (machine.value !== "connecting") return
    if (connected) {
      setPendingWalletName(null)
      return
    }
    if (!pendingWalletName) return

    if (!wallet || wallet.adapter.name !== pendingWalletName) {
      select(pendingWalletName)
      return
    }

    let cancelled = false

    void connect().catch((error) => {
      if (cancelled) return
      send({
        type: "ERROR",
        error: error instanceof Error ? error.message : "Connect failed",
      })
      setPendingWalletName(null)
    })

    return () => {
      cancelled = true
    }
  }, [machine.value, connected, pendingWalletName, wallet, select, connect])

  const handleSign = useCallback(async () => {
    try {
      if (!walletAddress || !signMessage) {
        throw new Error("Wallet not ready")
      }

      send({ type: "SIGN" })

      const noncePayload = await requestNonce({ walletAddress })
      const device = await getOrCreateAuthDeviceRegistration({
        walletAddress,
        signMessage,
      })
      const signature = await signMessage(
        new TextEncoder().encode(noncePayload.message)
      )

      send({ type: "VERIFY" })

      const verified = await signIn({
        walletAddress,
        nonce: noncePayload.nonce,
        message: noncePayload.message,
        signature: bs58.encode(signature),
        device,
      })

      send({ type: "SUCCESS", data: verified })
    } catch (error) {
      send({
        type: "ERROR",
        error: error instanceof Error ? error.message : "Auth failed",
      })
    }
  }, [walletAddress, signMessage, signIn])

  useEffect(() => {
    if (machine.value !== "connecting") return
    if (!connected || !walletAddress || !signMessage) return

    void handleSign()
  }, [machine.value, connected, walletAddress, signMessage, handleSign])

  useEffect(() => {
    if (machine.value !== "success") return

    onSignedIn?.(machine.data)

    const timeoutId = window.setTimeout(() => {
      send({ type: "RESET" })
      onOpenChange(false)
    }, 500)

    return () => window.clearTimeout(timeoutId)
  }, [machine, onOpenChange, onSignedIn])

  const handleClose = () => {
    setPendingWalletName(null)
    send({ type: "RESET" })
    onOpenChange(false)
  }

  const walletButtons = useMemo(
    () =>
      availableWallets.map((wallet) => (
        <Button
          key={wallet.adapter.name}
          onClick={() => handleConnect(wallet.adapter.name)}
          className="w-full"
        >
          Connect {wallet.adapter.name}
        </Button>
      )),
    [availableWallets, handleConnect]
  )

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>Wallet Sign-In</DialogTitle>
          <DialogDescription>Secure Solana authentication</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="text-xs text-muted-foreground">
            {walletAddress || "No wallet connected"}
          </div>

          {machine.value === "idle" && availableWallets.length ? walletButtons : null}
          {machine.value === "idle" && !availableWallets.length ? (
            <Empty className="border border-dashed border-border">
              <EmptyHeader>
                <EmptyTitle>No Solana wallet found</EmptyTitle>
                <EmptyDescription>
                  Install or unlock a wallet, then reopen sign-in.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}
          {machine.value === "connecting" && (
            <Alert>
              <Spinner />
              <AlertTitle>Waiting for wallet</AlertTitle>
              <AlertDescription>
                Approve the connection request in your wallet.
              </AlertDescription>
            </Alert>
          )}
          {machine.value === "signing" && (
            <Alert>
              <Spinner />
              <AlertTitle>Signature requested</AlertTitle>
              <AlertDescription>
                Sign the nonce message to prove wallet ownership.
              </AlertDescription>
            </Alert>
          )}
          {machine.value === "verifying" && (
            <Alert>
              <Spinner />
              <AlertTitle>Verifying session</AlertTitle>
              <AlertDescription>
                Registering this browser device and opening your encrypted chat.
              </AlertDescription>
            </Alert>
          )}

          {machine.value === "error" && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{machine.error}</AlertDescription>
            </Alert>
          )}

          {connected && (
            <Button
              variant="outline"
              className="w-full"
              onClick={async () => {
                setPendingWalletName(null)
                await disconnect()
                send({ type: "RESET" })
              }}
            >
              Disconnect
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
