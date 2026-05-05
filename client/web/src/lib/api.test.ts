import { afterEach, describe, expect, it, vi } from "vitest"

import { ApiRequestError, apiRequest } from "./api"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("apiRequest", () => {
  it("sends JSON bodies with auth and a request id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: { ok: true },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      )
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await apiRequest<{ ok: boolean }>("/demo", {
      method: "POST",
      accessToken: "token-123",
      body: { value: 1 },
    })

    expect(result).toEqual({ ok: true })
    const [, init] = fetchMock.mock.calls[0]
    const headers = init.headers as Headers
    expect(headers.get("authorization")).toBe("Bearer token-123")
    expect(headers.get("content-type")).toBe("application/json")
    expect(headers.get("x-request-id")).toBeTruthy()
    expect(init.body).toBe(JSON.stringify({ value: 1 }))
  })

  it("throws typed backend errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            error: "INSUFFICIENT_CREDITS",
            message: "Recharge required",
            details: { balance: 0 },
          }),
          {
            status: 402,
            headers: { "x-request-id": "req-1" },
          }
        )
      )
    )

    await expect(apiRequest("/demo")).rejects.toMatchObject({
      name: "ApiRequestError",
      status: 402,
      code: "INSUFFICIENT_CREDITS",
      message: "Recharge required",
      requestId: "req-1",
    } satisfies Partial<ApiRequestError>)
  })
})
