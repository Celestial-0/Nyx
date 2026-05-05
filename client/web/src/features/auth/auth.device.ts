"use client"

import { getOrCreateLocalDevice, getStoredAuthDeviceRegistration } from "@/features/e2ee/e2ee.service"

type SignMessageFn = (message: Uint8Array) => Promise<Uint8Array>

export { getStoredAuthDeviceRegistration }
export { buildDeviceRegistrationMessage } from "@/features/e2ee/e2ee.service"

export async function getOrCreateAuthDeviceRegistration(input: {
  walletAddress: string
  signMessage: SignMessageFn
}) {
  const localDevice = await getOrCreateLocalDevice(input)
  return localDevice.registration
}
