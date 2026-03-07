import {
	pgTable,
	varchar,
	timestamp,
	uuid,
	uniqueIndex,
	index,
	boolean,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";

export const PROVIDERS = {
	INTERNAL: "INTERNAL",
} as const;

export type Providers = (typeof PROVIDERS)[keyof typeof PROVIDERS];

export const identities = pgTable(
	"identities",
	{
		id: uuid("id")
			.primaryKey()
			.default(sql`gen_random_uuid()`),

		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),

		provider: varchar("provider", { length: 50 }).$type<Providers>().notNull(),

		providerUserId: varchar("provider_user_id", { length: 255 }).notNull(),

		email: varchar("email", { length: 255 }),

		emailVerified: boolean("email_verified").notNull().default(false),

		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => ({
		providerUserUnique: uniqueIndex("provider_user_unique").on(
			table.provider,
			table.providerUserId,
		),

		idxUserId: index("idx_identity_user_id").on(table.userId),
	}),
);
