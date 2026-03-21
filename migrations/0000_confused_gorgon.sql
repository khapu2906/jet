CREATE TYPE "public"."user_status" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"avatar" varchar(500),
	"bio" text,
	"phone" varchar(20),
	"language" varchar(10) DEFAULT 'en',
	"timezone" varchar(50) DEFAULT 'UTC',
	"status" "user_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_user_id" varchar(255) NOT NULL,
	"email" varchar(255),
	"email_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"password_hash" text NOT NULL,
	"email" varchar(255) NOT NULL,
	"username" varchar(255),
	"last_login_at" timestamp with time zone,
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "identities" ADD CONSTRAINT "identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_email_not_deleted" ON "users" USING btree ("email") WHERE "users"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_users_status" ON "users" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_user_unique" ON "identities" USING btree ("provider","provider_user_id");--> statement-breakpoint
CREATE INDEX "idx_identity_user_id" ON "identities" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_credential_email" ON "auth_credentials" USING btree ("email");