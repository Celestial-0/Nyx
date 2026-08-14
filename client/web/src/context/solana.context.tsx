/**
 * Solana Provider Context
 * 
 * Provides Solana connectivity and wallet adapter integration
 */

import { useMemo, type ReactNode } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";
import "@solana/wallet-adapter-react-ui/styles.css";

type SolanaProviderProps = {
  children: ReactNode;
};

export function SolanaProvider({ children }: SolanaProviderProps) {
  const endpoint = useMemo(() => clusterApiUrl("mainnet-beta"), []);
  const wallets = useMemo(() => [], []);
  const handleWalletError = (error: unknown) => {
    const walletError = error as { name?: string; message?: string };
    const name = walletError?.name ?? "";
    const message = walletError?.message ?? "";

    if (
      name.includes("WalletDisconnectedError") ||
      name.includes("WalletNotSelectedError") ||
      /wallet disconnected|wallet not selected/i.test(message)
    ) {
      return;
    }

    console.error("[Wallet]", error);
  };

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false} onError={handleWalletError}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
