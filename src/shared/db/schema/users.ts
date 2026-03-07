import {
	pgTable,
	varchar,
	text,
	timestamp,
	uuid,
	pgEnum,
	index,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const USER_STATUS = {
	ACTIVE: "ACTIVE",
	INACTIVE: "INACTIVE",
} as const;

export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];

export const userStatusEnum = pgEnum("user_status", [
	USER_STATUS.ACTIVE,
	USER_STATUS.INACTIVE,
]);

export const users = pgTable(
	"users",
	{
		id: uuid("id")
			.primaryKey()
			.default(sql`gen_random_uuid()`),

		email: varchar("email", { length: 255 }).notNull(),

		firstName: varchar("first_name", { length: 100 }),
		lastName: varchar("last_name", { length: 100 }),
		avatar: varchar("avatar", { length: 500 }),
		bio: text("bio"),
		phone: varchar("phone", { length: 20 }),

		language: varchar("language", { length: 10 }).default("en"),
		timezone: varchar("timezone", { length: 50 }).default("UTC"),

		status: userStatusEnum("status").notNull().default(USER_STATUS.ACTIVE),

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
				.where(sql`${table.deletedAt} IS NULL`),

			idxUserStatus: index("idx_users_status").on(table.status),
		};
	},
);
