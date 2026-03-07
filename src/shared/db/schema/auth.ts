import {
	pgTable,
	varchar,
	boolean,
	timestamp,
	uuid,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { USER_ROLES, UserRole } from "@/shared/auth/rbac/roles";
import { sql } from "drizzle-orm";


export const USER_STATUS = {
	ACTIVE: "ACTIVE",
	INACTIVE: "INACTIVE",
	DELETED: "DELETED",
} as const;

export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];


export const authUsers = pgTable(
	"auths",
	{
		id: uuid("id")
			.primaryKey()
			.default(sql`gen_random_uuid()`),

		email: varchar("email", { length: 255 }).notNull(),

		passwordHash: varchar("password_hash", { length: 255 }).notNull(),

		role: varchar("role", { length: 50 })
			.$type<UserRole>()
			.notNull()
			.default(USER_ROLES.NORMAL_USER),

		status: varchar("status", { length: 20 })
			.$type<UserStatus>()
			.notNull()
			.default(USER_STATUS.ACTIVE),

		emailVerified: boolean("email_verified")
			.notNull()
			.default(false),

		emailVerifiedAt: timestamp("email_verified_at", {
			withTimezone: true,
		}),

		lastLoginAt: timestamp("last_login_at", {
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

		deletedAt: timestamp("deleted_at", {
			withTimezone: true,
		}),
	},
	(table) => ({
		uniqueEmailNotDeleted: uniqueIndex("unique_email_not_deleted")
			.on(sql`lower(${table.email})`)
			.where(sql`${table.deletedAt} IS NULL`),
	}),
);

/**
 * Types
 */
export type AuthUserDB = typeof authUsers.$inferSelect;
export type NewAuthUserDB = typeof authUsers.$inferInsert;