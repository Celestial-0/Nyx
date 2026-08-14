import {
  PaymentCreditsSnapshotSchema,
  PaymentRechargeVerifyResponseSchema,
} from '@/types';

import { apiRequest } from './client';

export async function getPaymentsSnapshot(accessToken: string) {
  return PaymentCreditsSnapshotSchema.parse(
    await apiRequest('/payments/credits', { method: 'GET', accessToken })
  );
}

export async function verifyPaymentsRecharge(transactionHash: string, accessToken: string) {
  return PaymentRechargeVerifyResponseSchema.parse(
    await apiRequest('/payments/recharge/verify', {
      method: 'POST',
      accessToken,
      body: { transactionHash },
    })
  );
}
