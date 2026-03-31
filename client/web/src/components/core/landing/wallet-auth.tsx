import {
  useMemo,
  useReducer,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  WalletReadyState,
  type WalletName,
} from "@solana/wallet-adapter-base";
import { useForm } from "@tanstack/react-form";
import bs58 from "bs58";

import { requestNonce } from "@/lib/api/auth";
import type { VerifyResponse } from "@/api/auth/types";
import { useWalletAuth } from "@/hooks/useWalletAuth";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type AuthState =
  | { value: "idle" }
  | { value: "connecting" }
  | { value: "signing" }
  | { value: "verifying" }
  | { value: "profile"; data: VerifyResponse; error?: string }
  | { value: "success"; data: VerifyResponse }
  | { value: "error"; error: string };

type AuthEvent =
  | { type: "CONNECT" }
  | { type: "SIGN" }
  | { type: "VERIFY" }
  | { type: "REQUIRE_PROFILE"; data: VerifyResponse }
  | { type: "SUCCESS"; data: VerifyResponse }
  | { type: "COMPLETE_PROFILE"; data: VerifyResponse }
  | { type: "ERROR"; error: string }
  | { type: "RESET" };

function reducer(state: AuthState, event: AuthEvent): AuthState {
  switch (state.value) {
    case "idle":
      if (event.type === "CONNECT") return { value: "connecting" };
      return state;

    case "connecting":
      if (event.type === "SIGN") return { value: "signing" };
      if (event.type === "ERROR") return { value: "error", error: event.error };
      return state;

    case "signing":
      if (event.type === "VERIFY") return { value: "verifying" };
      if (event.type === "ERROR") return { value: "error", error: event.error };
      return state;

    case "verifying":
      if (event.type === "REQUIRE_PROFILE")
        return { value: "profile", data: event.data };
      if (event.type === "SUCCESS")
        return { value: "success", data: event.data };
      if (event.type === "ERROR")
        return { value: "error", error: event.error };
      return state;

    case "profile":
      if (event.type === "COMPLETE_PROFILE")
        return { value: "success", data: event.data };
      if (event.type === "ERROR")
        return { value: "profile", data: state.data, error: event.error };
      return state;

    case "success":
    case "error":
      if (event.type === "RESET") return { value: "idle" };
      return state;

    default:
      return state;
  }
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignedIn?: (data: VerifyResponse) => void;
};

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
  } = useWallet();

  const { signIn, saveProfile } = useWalletAuth();

  const [machine, send] = useReducer(reducer, { value: "idle" });
  const [pendingWalletName, setPendingWalletName] = useState<WalletName | null>(null);
  const [usernameConflict, setUsernameConflict] = useState(false);

  const walletAddress = useMemo(
    () => publicKey?.toBase58() ?? null,
    [publicKey]
  );

  const availableWallets = useMemo(() => {
    return wallets.filter(
      (w) =>
        w.readyState === WalletReadyState.Installed ||
        w.readyState === WalletReadyState.Loadable
    );
  }, [wallets]);

  // 🔌 CONNECT
  const handleConnect = useCallback(
    async (walletName?: WalletName) => {
      try {
        send({ type: "CONNECT" });

        if (connected) {
          return;
        }

        const selected =
          availableWallets.find((w) => w.adapter.name === walletName) ??
          availableWallets[0];

        if (!selected) throw new Error("No wallet found");

        setPendingWalletName(selected.adapter.name);
        select(selected.adapter.name);
      } catch (err) {
        send({
          type: "ERROR",
          error: err instanceof Error ? err.message : "Connect failed",
        });
      }
    },
    [availableWallets, select, connected]
  );

  useEffect(() => {
    if (machine.value !== "connecting") return;
    if (connected) {
      setPendingWalletName(null);
      return;
    }
    if (!pendingWalletName) return;

    // Wait until wallet context reflects the selected adapter before connecting.
    if (!wallet || wallet.adapter.name !== pendingWalletName) {
      select(pendingWalletName);
      return;
    }

    let cancelled = false;

    void connect().catch((err) => {
      if (cancelled) return;
      send({
        type: "ERROR",
        error: err instanceof Error ? err.message : "Connect failed",
      });
      setPendingWalletName(null);
    });

    return () => {
      cancelled = true;
    };
  }, [machine.value, connected, pendingWalletName, wallet, select, connect]);

  // ✅ WAIT FOR WALLET READY → THEN SIGN
  useEffect(() => {
    if (machine.value !== "connecting") return;
    if (!connected || !walletAddress || !signMessage) return;

    void handleSign();
  }, [machine.value, connected, walletAddress, signMessage]);

  // ✍️ SIGN + VERIFY
  const handleSign = useCallback(async () => {
    try {
      if (!walletAddress || !signMessage)
        throw new Error("Wallet not ready");

      send({ type: "SIGN" });

      const noncePayload = await requestNonce({ walletAddress });

      const signature = await signMessage(
        new TextEncoder().encode(noncePayload.message)
      );

      send({ type: "VERIFY" });

      await signIn({
        walletAddress,
        nonce: noncePayload.nonce,
        message: noncePayload.message,
        signature: bs58.encode(signature),
      });

      // After signIn, check if profile is complete
      // If first sign-in and profile incomplete, require profile completion
      // Otherwise, sign-in is complete
      send({ type: "SUCCESS", data: {} as VerifyResponse });
    } catch (err) {
      send({
        type: "ERROR",
        error: err instanceof Error ? err.message : "Auth failed",
      });
    }
  }, [walletAddress, signMessage, signIn]);

  // 👤 PROFILE
  const profileForm = useForm({
    defaultValues: { username: "", displayName: "" },
    onSubmit: async ({ value }) => {
      try {
        setUsernameConflict(false);
        const username = value.username.trim();
        const displayName = value.displayName.trim();

        if (!username || !displayName) {
          send({ type: "ERROR", error: "All fields required" });
          return;
        }

        if (machine.value !== "profile") return;

        await saveProfile({
          username,
          displayName,
        });

        const updated = {
          ...machine.data,
          profile: {
            walletAddress: machine.data.profile.walletAddress,
            username,
            displayName,
            profileComplete: true,
          },
        };

        send({ type: "COMPLETE_PROFILE", data: updated });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to save profile. Please try again.";

        const likelyUsernameConflict =
          /username|taken|exists|unique/i.test(message) ||
          /status 500/i.test(message);

        setUsernameConflict(likelyUsernameConflict);
        send({
          type: "ERROR",
          error: message,
        });
      }
    },
  });

  // ✅ SUCCESS → CLOSE
  useEffect(() => {
    if (machine.value === "success") {
      onSignedIn?.(machine.data);

      const t = setTimeout(() => {
        send({ type: "RESET" });
        onOpenChange(false);
      }, 500);

      return () => clearTimeout(t);
    }
  }, [machine.value]);

  const handleClose = () => {
    setPendingWalletName(null);
    send({ type: "RESET" });
    onOpenChange(false);
  };

  const walletButtons = useMemo(
    () =>
      availableWallets.map((w) => (
        <Button
          key={w.adapter.name}
          onClick={() => handleConnect(w.adapter.name)}
          className="w-full"
        >
          Connect {w.adapter.name}
        </Button>
      )),
    [availableWallets, handleConnect]
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>Wallet Sign-In</DialogTitle>
          <DialogDescription>
            Secure Solana authentication
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-xs text-muted-foreground">
            {walletAddress || "No wallet connected"}
          </div>

          {machine.value === "idle" && walletButtons}

          {machine.value === "connecting" && (
            <p>Waiting for wallet...</p>
          )}

          {machine.value === "signing" && <p>Sign message...</p>}
          {machine.value === "verifying" && <p>Verifying...</p>}

          {machine.value === "profile" && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void profileForm.handleSubmit();
              }}
            >
              <Input
                placeholder="Username"
                className={usernameConflict ? "border-destructive focus-visible:ring-destructive/40" : undefined}
                onChange={(e) =>
                  {
                    setUsernameConflict(false);
                    profileForm.setFieldValue("username", e.target.value)
                  }
                }
              />
              {usernameConflict ? (
                <p className="text-xs text-destructive">
                  Username already exists. Please choose a different username.
                </p>
              ) : null}
              <Input
                placeholder="Name"
                onChange={(e) =>
                  profileForm.setFieldValue("displayName", e.target.value)
                }
              />
              <Button type="submit" className="w-full">
                Continue
              </Button>

              {machine.error ? (
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{machine.error}</AlertDescription>
                </Alert>
              ) : null}
            </form>
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
                setPendingWalletName(null);
                await disconnect();
                send({ type: "RESET" });
              }}
            >
              Disconnect
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}