import { and, eq, isNull } from "drizzle-orm";
import { userContacts, users } from "@/platform/db/schema";
import type {
  ContactsDb,
  CreateContactInput,
  UpdateContactInput,
} from "@/features/contacts/types";
import { BadRequest, NotFound } from "@/shared/error";

const userSelect = {
  id: users.id,
  walletAddress: users.walletAddress,
  username: users.username,
  fullName: users.fullName,
  role: users.role,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};

const contactSelect = {
  alias: userContacts.alias,
  createdAt: userContacts.createdAt,
  updatedAt: userContacts.updatedAt,
  user: userSelect,
};

type ContactUserProfileRow = {
  id: string;
  walletAddress: string;
  username: string | null;
  fullName: string | null;
  role: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

type ContactEntryRow = {
  alias: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  user: ContactUserProfileRow;
};

const toProfile = (user: ContactUserProfileRow) => ({
  id: user.id,
  walletAddress: user.walletAddress,
  username: user.username,
  displayName: user.fullName,
  role: user.role,
  createdAt: (user.createdAt ?? new Date()).toISOString(),
  updatedAt: (user.updatedAt ?? new Date()).toISOString(),
});

const toContactEntry = (row: ContactEntryRow) => ({
  user: toProfile(row.user),
  alias: row.alias,
  createdAt: (row.createdAt ?? new Date()).toISOString(),
  updatedAt: (row.updatedAt ?? new Date()).toISOString(),
});

const assertContactUserExists = async (db: ContactsDb, contactUserId: string) => {
  const rows = await db
    .select(userSelect)
    .from(users)
    .where(and(eq(users.id, contactUserId), isNull(users.deletedAt)))
    .limit(1);

  const user = rows[0] ?? null;

  if (!user) {
    throw NotFound("Contact user not found.");
  }

  return user;
};

export const contactsService = {
  list: async ({ db, ownerUserId }: { db: ContactsDb; ownerUserId: string }) => {
    const rows = await db
      .select(contactSelect)
      .from(userContacts)
      .innerJoin(users, eq(users.id, userContacts.contactUserId))
      .where(
        and(eq(userContacts.ownerUserId, ownerUserId), isNull(users.deletedAt))
      );

    return {
      contacts: rows.map((row) => toContactEntry(row)),
    };
  },

  save: async ({
    db,
    ownerUserId,
    input,
  }: {
    db: ContactsDb;
    ownerUserId: string;
    input: CreateContactInput;
  }) => {
    if (ownerUserId === input.contactUserId) {
      throw BadRequest("You cannot save yourself as a contact.");
    }

    await assertContactUserExists(db, input.contactUserId);
    const now = new Date();

    await db
      .insert(userContacts)
      .values({
        ownerUserId,
        contactUserId: input.contactUserId,
        alias: input.alias?.trim() || null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [userContacts.ownerUserId, userContacts.contactUserId],
        set: {
          alias: input.alias?.trim() || null,
          updatedAt: now,
        },
      });

    return contactsService.getByContactUserId({
      db,
      ownerUserId,
      contactUserId: input.contactUserId,
    });
  },

  getByContactUserId: async ({
    db,
    ownerUserId,
    contactUserId,
  }: {
    db: ContactsDb;
    ownerUserId: string;
    contactUserId: string;
  }) => {
    const rows = await db
      .select(contactSelect)
      .from(userContacts)
      .innerJoin(users, eq(users.id, userContacts.contactUserId))
      .where(
        and(
          eq(userContacts.ownerUserId, ownerUserId),
          eq(userContacts.contactUserId, contactUserId),
          isNull(users.deletedAt)
        )
      )
      .limit(1);

    const row = rows[0] ?? null;

    if (!row) {
      throw NotFound("Contact not found.");
    }

    return toContactEntry({
      alias: row.alias,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      user: row.user,
    });
  },

  update: async ({
    db,
    ownerUserId,
    contactUserId,
    input,
  }: {
    db: ContactsDb;
    ownerUserId: string;
    contactUserId: string;
    input: UpdateContactInput;
  }) => {
    const updated = await db
      .update(userContacts)
      .set({
        alias: input.alias?.trim() || null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userContacts.ownerUserId, ownerUserId),
          eq(userContacts.contactUserId, contactUserId)
        )
      )
      .returning({ contactUserId: userContacts.contactUserId });

    if (!updated[0]) {
      throw NotFound("Contact not found.");
    }

    return contactsService.getByContactUserId({
      db,
      ownerUserId,
      contactUserId,
    });
  },

  remove: async ({
    db,
    ownerUserId,
    contactUserId,
  }: {
    db: ContactsDb;
    ownerUserId: string;
    contactUserId: string;
  }) => {
    await db
      .delete(userContacts)
      .where(
        and(
          eq(userContacts.ownerUserId, ownerUserId),
          eq(userContacts.contactUserId, contactUserId)
        )
      );

    return {
      removed: true as const,
      contactUserId,
    };
  },
};
