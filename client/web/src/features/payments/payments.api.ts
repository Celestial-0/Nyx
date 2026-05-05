import { apiRequest } from "@/lib/api"

import type {
  PaymentCreditsSnapshot,
  PaymentRechargeVerifyResponse,
} from "./payments.types"

export function getPaymentsSnapshot(accessToken: string) {
  return apiRequest<PaymentCreditsSnapshot>("/payments/credits", {
    method: "GET",
    accessToken,
  })
}

export function verifyPaymentsRecharge(
  transactionHash: string,
  accessToken: string
) {
  return apiRequest<PaymentRechargeVerifyResponse>(
    "/payments/recharge/verify",
    {
      method: "POST",
      accessToken,
      body: { transactionHash },
    }
  )
}
