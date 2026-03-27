import { Elysia } from "elysia";
import { eventBus } from "../events";

export const eventPlugin = new Elysia()
  .decorate("eventBus", eventBus);