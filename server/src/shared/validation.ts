import { validator } from "hono/validator";
import { z } from "zod";
import { ValidationError } from "@/shared/error";

const parseWithSchema = <T extends z.ZodTypeAny>(schema: T, value: unknown) => {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw ValidationError(z.treeifyError(result.error));
  }

  return result.data;
};

export const zodJson = <T extends z.ZodTypeAny>(schema: T) =>
  validator("json", (value) => parseWithSchema(schema, value));

export const zodQuery = <T extends z.ZodTypeAny>(schema: T) =>
  validator("query", (value) => parseWithSchema(schema, value));
