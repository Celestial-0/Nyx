import { OpenAPIHono } from "@hono/zod-openapi";
import {
  createContactRoute,
  deleteContactRoute,
  listContactsRoute,
  updateContactRoute,
} from "@/features/contacts/openapi";
import { contactsService } from "@/features/contacts/service";
import type { AppBindings } from "@/types/global";
import { success } from "@/http/response";

export const contactRoutes = new OpenAPIHono<AppBindings>().basePath("/contacts");

contactRoutes.openapi(listContactsRoute, async (c) => {
  const authUser = c.get("authUser");
  const data = await contactsService.list({
    db: c.get("db"),
    ownerUserId: authUser!.id,
  });

  return c.json(success(data), 200);
});

contactRoutes.openapi(createContactRoute, async (c) => {
  const authUser = c.get("authUser");
  const data = await contactsService.save({
    db: c.get("db"),
    ownerUserId: authUser!.id,
    input: c.req.valid("json"),
  });

  return c.json(success(data), 200);
});

contactRoutes.openapi(updateContactRoute, async (c) => {
  const authUser = c.get("authUser");
  const { contactUserId } = c.req.valid("param");
  const data = await contactsService.update({
    db: c.get("db"),
    ownerUserId: authUser!.id,
    contactUserId,
    input: c.req.valid("json"),
  });

  return c.json(success(data), 200);
});

contactRoutes.openapi(deleteContactRoute, async (c) => {
  const authUser = c.get("authUser");
  const { contactUserId } = c.req.valid("param");
  const data = await contactsService.remove({
    db: c.get("db"),
    ownerUserId: authUser!.id,
    contactUserId,
  });

  return c.json(success(data), 200);
});
