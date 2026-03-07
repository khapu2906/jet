import {
	pgTable,
	text,
	timestamp,
	uuid,
	integer,
	varchar,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const authCredentials = pgTable(
	"auth_credentials",
	{
		id: uuid("id")
			.primaryKey()
			.default(sql`gen_random_uuid()`),

		passwordHash: text("password_hash").notNull(),

		email: varchar("email", { length: 255 }).notNull(),
		username: varchar("username", { length: 255 }),

		lastLoginAt: timestamp("last_login_at", {
			withTimezone: true,
		}),

		failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),

		lockedUntil: timestamp("locked_until", {
			withTimezone: true,
		}),

		createdAt: timestamp("created_at", {
			withTimezone: true,
		})
			.notNull()
			.defaultNow(),

		updatedAt: timestamp("updated_at", {
			withTimezone: true,
		})
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => ({
		uniqueCredentialEmail: uniqueIndex("unique_credential_email").on(table.email),
	}),
);
