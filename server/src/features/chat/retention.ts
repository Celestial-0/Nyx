import { env } from "@/config/env";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const getMessageRetentionCutoff = (now = new Date()) =>
  new Date(now.getTime() - env.MESSAGE_RETENTION_DAYS * DAY_IN_MS);
