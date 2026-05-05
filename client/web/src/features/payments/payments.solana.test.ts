import { describe, expect, it } from "vitest"

import { parseSolAmountToLamports } from "./payments.solana"

describe("parseSolAmountToLamports", () => {
  it("parses whole and fractional SOL amounts", () => {
    expect(parseSolAmountToLamports("1")).toBe(1_000_000_000n)
    expect(parseSolAmountToLamports("0.000000001")).toBe(1n)
    expect(parseSolAmountToLamports("2.5")).toBe(2_500_000_000n)
  })

  it("rejects empty, zero, and over-precision values", () => {
    expect(() => parseSolAmountToLamports("")).toThrow("Enter a SOL amount")
    expect(() => parseSolAmountToLamports("0")).toThrow(
      "greater than 0 SOL"
    )
    expect(() => parseSolAmountToLamports("0.0000000001")).toThrow(
      "up to 9 decimal"
    )
  })
})
