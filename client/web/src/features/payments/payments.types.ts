export type PaymentPricing = {
  creditsPerSol: number
  defaultInitialCredits: number
  messageSendCredits: number
  groupRoomCreateCredits: number
}

export type PaymentTreasury = {
  walletAddress: string
}

export type PaymentNetwork = {
  chain: "solana"
  rpcUrl: string
  commitment: string
}

export type PaymentRechargeActivity = {
  id: string
  transactionHash: string
  amountSol: string
  creditsGranted: number
  status: "confirmed"
  network: string | null
  verifiedAt: string | null
  createdAt: string | null
}

export type PaymentCreditActivity = {
  id: string
  change: number
  reason: string
  createdAt: string | null
}

export type PaymentCreditsSnapshot = {
  balance: number
  pricing: PaymentPricing
  treasury: PaymentTreasury
  network: PaymentNetwork
  recentRecharges: PaymentRechargeActivity[]
  recentActivity: PaymentCreditActivity[]
}

export type PaymentRechargeVerifyResponse = {
  transactionHash: string
  amountSol: string
  creditsGranted: number
  balance: number
  status: "confirmed"
}

export type PaymentsPanelSource =
  | "sidebar"
  | "profile"
  | "settings"
  | "message-send"
  | "group-create"

export type PaymentRechargeState = "idle" | "sending" | "verifying" | "success" | "error"
