import { Jwt } from "hono/utils/jwt";
import { env } from "@/config/env";

const algorithm = "HS256" as const;

export const jwtService = {
  sign: (payload: Record<string, unknown>) => Jwt.sign(payload, env.JWT_SECRET, algorithm),
  verify: (token: string) =>
    Jwt.verify(token, env.JWT_SECRET, {
      alg: algorithm,
    }),
};
