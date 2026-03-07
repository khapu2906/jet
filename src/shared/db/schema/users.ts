import {
	pgTable,
	varchar,
	integer,
	text,
	timestamp,
	uuid,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { USER_ROLES } from "@/shared/auth/rbac/roles";
import { sql } from "drizzle-orm";

export const USER_STATUS = {
	ACTIVE: "ACTIVE",
	INACTIVE: "INACTIVE",
	DELETED: "DELETED",
} as const;

export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];

export const users = pgTable(
	"users",
	{
		id: uuid("id")
			.primaryKey()
			.default(sql`gen_random_uuid()`),
		email: varchar("email", { length: 255 }).notNull(),
		username: varchar("username", { length: 100 }).notNull(),
		firstName: varchar("first_name", { length: 100 }),
		lastName: varchar("last_name", { length: 100 }),
		avatar: text("avatar"),
		bio: text("bio"),
		role: varchar("role", { length: 50 })
			.notNull()
			.default(USER_ROLES.NORMAL_USER),
		status: varchar("status", { length: 20 })
			.notNull()
			.default(USER_STATUS.ACTIVE),
		emailVerified: integer("email_verified").notNull().default(0),
		emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
		lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
		phone: varchar("phone", { length: 20 }),
		timezone: varchar("timezone", { length: 50 }).default("UTC"),
		language: varchar("language", { length: 10 }).default("en"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
	},
	(table) => {
		return {
			uniqueEmailNotDeleted: uniqueIndex("unique_email_not_deleted")
				.on(table.email)
				.where(sql`status != 'DELETED'`),
			uniqueUsernameNotDeleted: uniqueIndex("unique_username_not_deleted")
				.on(table.username)
				.where(sql`status != 'DELETED'`),
		};
	},
);
/**
 * Inferred types from schema
 */
export type UserDB = typeof users.$inferSelect;
