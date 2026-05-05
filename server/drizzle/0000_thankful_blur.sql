CREATE TYPE "public"."user_device_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin', 'mod');--> statement-breakpoint
CREATE TYPE "public"."room_member_role" AS ENUM('admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."room_type" AS ENUM('direct', 'group');--> statement-breakpoint
CREATE TYPE "public"."sender_key_epoch_status" AS ENUM('pending', 'active', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('sent', 'delivered', 'read');--> statement-breakpoint
CREATE TYPE "public"."message_type" AS ENUM('text', 'image', 'system');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'confirmed', 'failed');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" text NOT NULL,
	"username" text,
	"full_name" text,
	"role" "user_role" DEFAULT 'user',
	"is_banned" boolean DEFAULT false,
	"last_seen_at" timestamp with time zone,
	"username_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_wallet_address_unique" UNIQUE("wallet_address"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "user_credits" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "credit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"change" integer NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blocker_id" uuid NOT NULL,
	"blocked_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_devices" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"identity_key" jsonb NOT NULL,
	"registration_message" text NOT NULL,
	"registration_signature" text NOT NULL,
	"fingerprint" text NOT NULL,
	"status" "user_device_status" DEFAULT 'active' NOT NULL,
	"registered_at" timestamp with time zone DEFAULT now(),
	"last_seen_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "device_signed_prekeys" (
	"device_id" uuid PRIMARY KEY NOT NULL,
	"key_id" uuid NOT NULL,
	"public_key" text NOT NULL,
	"signature" text NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "device_one_time_prekeys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"key_id" uuid NOT NULL,
	"public_key" text NOT NULL,
	"consumed_at" timestamp with time zone,
	"consumed_by_user_id" uuid,
	"consumed_for_conversation_id" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "room_type" NOT NULL,
	"direct_key" text,
	"created_by" uuid NOT NULL,
	"last_message_id" uuid,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "room_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "room_member_role" DEFAULT 'member',
	"joined_at" timestamp with time zone DEFAULT now(),
	"left_at" timestamp with time zone,
	"muted_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "room_sender_key_epochs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"algorithm" text NOT NULL,
	"status" "sender_key_epoch_status" DEFAULT 'pending' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_by_device_id" uuid,
	"activated_at" timestamp with time zone,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "room_sender_key_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"epoch_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"created_by_device_id" uuid NOT NULL,
	"encrypted_share" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"sender_id" uuid,
	"content" jsonb NOT NULL,
	"type" "message_type" DEFAULT 'text',
	"created_at" timestamp with time zone DEFAULT now(),
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "message_delivery" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "message_status" NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "message_visibility" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"is_hidden" boolean DEFAULT false,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount_sol" numeric NOT NULL,
	"credits_granted" integer NOT NULL,
	"tx_hash" text,
	"network" text,
	"status" "payment_status" NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "payments_tx_hash_unique" UNIQUE("tx_hash")
);
--> statement-breakpoint
CREATE INDEX "user_devices_user_idx" ON "user_devices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_devices_status_idx" ON "user_devices" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "device_one_time_prekeys_device_key_unique" ON "device_one_time_prekeys" USING btree ("device_id","key_id");--> statement-breakpoint
CREATE INDEX "device_one_time_prekeys_device_idx" ON "device_one_time_prekeys" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "device_one_time_prekeys_consumed_idx" ON "device_one_time_prekeys" USING btree ("consumed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "rooms_direct_key_unique" ON "rooms" USING btree ("direct_key") WHERE "rooms"."direct_key" is not null;--> statement-breakpoint
CREATE INDEX "rooms_last_message_idx" ON "rooms" USING btree ("last_message_at");--> statement-breakpoint
CREATE UNIQUE INDEX "room_user_unique" ON "room_members" USING btree ("room_id","user_id");--> statement-breakpoint
CREATE INDEX "room_sender_key_epochs_room_idx" ON "room_sender_key_epochs" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "room_sender_key_epochs_status_idx" ON "room_sender_key_epochs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "room_sender_key_shares_epoch_device_unique" ON "room_sender_key_shares" USING btree ("epoch_id","device_id");--> statement-breakpoint
CREATE INDEX "room_sender_key_shares_room_idx" ON "room_sender_key_shares" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "room_sender_key_shares_device_idx" ON "room_sender_key_shares" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "messages_room_idx" ON "messages" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "messages_created_idx" ON "messages" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "message_delivery_message_user_unique" ON "message_delivery" USING btree ("message_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "message_visibility_message_user_unique" ON "message_visibility" USING btree ("message_id","user_id");