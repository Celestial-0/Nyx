CREATE TABLE "user_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"contact_user_id" uuid NOT NULL,
	"alias" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "user_contacts_owner_contact_unique" ON "user_contacts" USING btree ("owner_user_id","contact_user_id");--> statement-breakpoint
CREATE INDEX "user_contacts_owner_idx" ON "user_contacts" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "user_contacts_contact_idx" ON "user_contacts" USING btree ("contact_user_id");