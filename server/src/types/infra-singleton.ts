import type { Elysia, SingletonBase } from "elysia";
import type * as dbClient from "@/db/client";
import type * as redisClient from "@/redis/client";
import type * as eventModule from "@/events";
import type { jwtPlugin } from "@/plugins/jwt.plugin";

type PluginSingleton<TPlugin> = TPlugin extends Elysia<
  string,
  infer TSingleton,
  infer _TDefinitions,
  infer _TMetadata,
  infer _TRoutes,
  infer _TEphemeral,
  infer _TVolatile
>
  ? TSingleton
  : never;

type JwtDecorator = PluginSingleton<typeof jwtPlugin>["decorator"]["jwt"];

export type InfraSingleton = SingletonBase & {
  decorator: SingletonBase["decorator"] & {
    db: typeof dbClient.db;
    redis: typeof redisClient.redis;
    jwt: JwtDecorator;
    eventBus: typeof eventModule.eventBus;
  };
};
