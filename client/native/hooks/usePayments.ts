import { useCallback, useEffect } from 'react';

import { paymentsApi } from '@/lib/api';
import { getAuthenticatedAccessToken } from '@/lib/auth';
import { useAuthStore } from '@/store/auth.store';
import { usePaymentsStore } from '@/store/payments.store';
import type { PaymentRechargeVerifyResponse, PaymentsPanelSource } from '@/types';

import { parseSolAmountToLamports, sendSolRechargeTransaction } from '@/lib/payments/payments.solana';

/** Payments/credits actions + hook. Ported from web `payments.hooks.ts`. */

async function requireAccessToken() {
  return getAuthenticatedAccessToken();
}

export async function loadPaymentsSnapshotAction(options?: { background?: boolean }) {
  const payments = usePaymentsStore.getState();
  const isBackground = options?.background === true;

  if (!isBackground) {
    payments.setStatus('loading');
  }

  payments.setError(null);

  try {
    const accessToken = await requireAccessToken();
    const snapshot = await paymentsApi.getPaymentsSnapshot(accessToken);
    payments.setSnapshot(snapshot);
    return snapshot;
  } catch (error) {
    if (!isBackground) {
      payments.setStatus('error');
      payments.setError(
        error instanceof Error ? error.message : 'Unable to load your credits right now.'
      );
    }
    throw error;
  }
}

export function openPaymentsPanelAction(input?: {
  source?: PaymentsPanelSource | null;
  recoveryMessage?: string | null;
}) {
  const payments = usePaymentsStore.getState();
  payments.openPanel(input);

  if (payments.status === 'idle') {
    void loadPaymentsSnapshotAction().catch(() => undefined);
  }
}

export function closePaymentsPanelAction() {
  usePaymentsStore.getState().closePanel();
}

export async function verifyRechargeTransactionAction(transactionHash: string) {
  const payments = usePaymentsStore.getState();
  payments.setRechargeState('verifying');
  payments.setRechargeError(null);

  try {
    const accessToken = await requireAccessToken();
    const response = await paymentsApi.verifyPaymentsRecharge(transactionHash, accessToken);

    payments.setLastRecharge(response);
    payments.setRechargeState('success');

    await loadPaymentsSnapshotAction({ background: true });
    return response;
  } catch (error) {
    payments.setRechargeState('error');
    payments.setRechargeError(
      error instanceof Error ? error.message : 'Unable to verify this recharge.'
    );
    throw error;
  }
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
  }));
}

/**
 * Full recharge flow: build + sign + submit the SOL transfer via MWA, then
 * verify the tx hash on the backend.
 */
export async function rechargeCreditsAction(amountSol: string) {
  const payments = usePaymentsStore.getState();
  const authUser = useAuthStore.getState().user;
  const snapshot = payments.snapshot;

  if (!authUser) {
    throw new Error('Not authenticated');
  }
  if (!snapshot) {
    throw new Error('Load your credit balance before recharging.');
  }

  payments.setRechargeState('sending');
  payments.setRechargeError(null);

  try {
    const amountLamports = parseSolAmountToLamports(amountSol);
    const transactionHash = await sendSolRechargeTransaction({
      rpcUrl: snapshot.network.rpcUrl,
      walletAddress: authUser.walletAddress,
      treasuryWalletAddress: snapshot.treasury.walletAddress,
      amountLamports,
    });

    const result = await verifyRechargeTransactionAction(transactionHash);
    applyRechargeResultAction(result);
    return result;
  } catch (error) {
    payments.setRechargeState('error');
    payments.setRechargeError(
      error instanceof Error ? error.message : 'Recharge failed. Please try again.'
    );
    throw error;
  }
}

export function usePaymentsPanel() {
  const isOpen = usePaymentsStore((state) => state.isOpen);
  const openSource = usePaymentsStore((state) => state.openSource);
  const recoveryMessage = usePaymentsStore((state) => state.recoveryMessage);
  const snapshot = usePaymentsStore((state) => state.snapshot);
  const status = usePaymentsStore((state) => state.status);
  const error = usePaymentsStore((state) => state.error);
  const rechargeState = usePaymentsStore((state) => state.rechargeState);
  const rechargeError = usePaymentsStore((state) => state.rechargeError);
  const lastRecharge = usePaymentsStore((state) => state.lastRecharge);
  const authStatus = useAuthStore((state) => state.status);

  useEffect(() => {
    if (authStatus !== 'authenticated') {
      usePaymentsStore.getState().reset();
    }
  }, [authStatus]);

  const open = useCallback(
    (input?: { source?: PaymentsPanelSource | null; recoveryMessage?: string | null }) => {
      openPaymentsPanelAction(input);
    },
    []
  );

  const close = useCallback(() => {
    closePaymentsPanelAction();
  }, []);

  const refresh = useCallback(async () => {
    return loadPaymentsSnapshotAction();
  }, []);

  const recharge = useCallback(async (amountSol: string) => {
    return rechargeCreditsAction(amountSol);
  }, []);

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
    recharge,
  };
}
