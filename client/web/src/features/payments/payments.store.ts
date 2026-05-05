import { create } from "zustand"

import type {
  PaymentCreditsSnapshot,
  PaymentRechargeState,
  PaymentRechargeVerifyResponse,
  PaymentsPanelSource,
} from "./payments.types"

type PaymentsState = {
  isOpen: boolean
  openSource: PaymentsPanelSource | null
  recoveryMessage: string | null
  snapshot: PaymentCreditsSnapshot | null
  status: "idle" | "loading" | "ready" | "error"
  error: string | null
  rechargeState: PaymentRechargeState
  rechargeError: string | null
  lastRecharge: PaymentRechargeVerifyResponse | null
}

type PaymentsActions = {
  openPanel: (input?: {
    source?: PaymentsPanelSource | null
    recoveryMessage?: string | null
  }) => void
  closePanel: () => void
  setStatus: (status: PaymentsState["status"]) => void
  setError: (error: string | null) => void
  setSnapshot: (snapshot: PaymentCreditsSnapshot) => void
  patchSnapshot: (updater: (snapshot: PaymentCreditsSnapshot) => PaymentCreditsSnapshot) => void
  setRechargeState: (state: PaymentRechargeState) => void
  setRechargeError: (error: string | null) => void
  setLastRecharge: (recharge: PaymentRechargeVerifyResponse | null) => void
  reset: () => void
}

type PaymentsStore = PaymentsState & PaymentsActions

const initialState: PaymentsState = {
  isOpen: false,
  openSource: null,
  recoveryMessage: null,
  snapshot: null,
  status: "idle",
  error: null,
  rechargeState: "idle",
  rechargeError: null,
  lastRecharge: null,
}

export const usePaymentsStore = create<PaymentsStore>((set) => ({
  ...initialState,
  openPanel: (input) =>
    set({
      isOpen: true,
      openSource: input?.source ?? null,
      recoveryMessage: input?.recoveryMessage ?? null,
    }),
  closePanel: () =>
    set({
      isOpen: false,
      openSource: null,
      recoveryMessage: null,
      rechargeState: "idle",
      rechargeError: null,
      lastRecharge: null,
    }),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
  setSnapshot: (snapshot) =>
    set({
      snapshot,
      status: "ready",
      error: null,
    }),
  patchSnapshot: (updater) =>
    set((state) => ({
      snapshot: state.snapshot ? updater(state.snapshot) : state.snapshot,
    })),
  setRechargeState: (rechargeState) => set({ rechargeState }),
  setRechargeError: (rechargeError) => set({ rechargeError }),
  setLastRecharge: (lastRecharge) => set({ lastRecharge }),
  reset: () => set({ ...initialState }),
}))
