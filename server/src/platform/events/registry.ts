import { authEventSchemas } from "@/features/auth/events/schema";
import { chatEventSchemas } from "@/features/chat/events/schema";
import { dmEventSchemas } from "@/features/dm/events/schema";
import { paymentEventSchemas } from "@/features/payments/events/schema";
import { roomsEventSchemas } from "@/features/rooms/events/schema";

export const eventSchemas = {
  ...authEventSchemas,
  ...chatEventSchemas,
  ...roomsEventSchemas,
  ...dmEventSchemas,
  ...paymentEventSchemas,
};

export type AppEventSchemas = typeof eventSchemas;
