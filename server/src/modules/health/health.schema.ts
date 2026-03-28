import { t } from "elysia";

export const healthServiceStatusSchema = t.Union([
	t.Literal("ok"),
	t.Literal("error"),
]);

export const healthOverallStatusSchema = t.Union([
	t.Literal("ok"),
    t.Literal("partial"),
	t.Literal("degraded"),
]);

export const healthDataSchema = t.Object({
	status: healthOverallStatusSchema,
	services: t.Object({
		db: healthServiceStatusSchema,
		redis: healthServiceStatusSchema,
	}),
	time: t.String(),
});

export const healthSuccessResponseSchema = t.Object({
	success: t.Literal(true),
	data: healthDataSchema,
});
