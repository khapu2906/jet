import postgres from "postgres";
import "dotenv/config";

const config = {
	host: process.env.DB_HOST || "localhost",
	port: parseInt(process.env.DB_PORT || "5432"),
	username: process.env.DB_USER || "postgres",
	password: process.env.DB_PASSWORD || "postgres",
	database: process.env.DB_NAME || "jet-db",
};

const sql = postgres(config);

async function resetDatabase() {
	console.log("⚠️  WARNING: This will delete all data in the database!\n");
	console.log(`Database: ${config.database}@${config.host}:${config.port}\n`);

	// Give user 3 seconds to cancel (Ctrl+C)
	console.log("Press Ctrl+C to cancel...");
	await new Promise((resolve) => setTimeout(resolve, 3000));

	console.log("\n🔄 Resetting database...\n");

	try {
		// Get all tables
		console.log("1. Fetching all tables...");
		const tables = await sql`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
    `;

		if (tables.length === 0) {
			console.log("ℹ️  No tables found to drop\n");
		} else {
			console.log(`Found ${tables.length} tables to drop\n`);

			// Drop all tables
			console.log("2. Dropping all tables...");
			for (const table of tables) {
				await sql.unsafe(`DROP TABLE IF EXISTS "${table.tablename}" CASCADE`);
				console.log(`  ✅ Dropped ${table.tablename}`);
			}
		}

		// Drop Drizzle migrations schema
		console.log("\n3. Dropping Drizzle migrations...");
		await sql.unsafe("DROP SCHEMA IF EXISTS drizzle CASCADE");
		console.log("  ✅ Dropped drizzle schema");

		// Drop all custom types (enums)
		console.log("\n4. Dropping custom types...");
		const types = await sql`
      SELECT typname
      FROM pg_type
      WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      AND typtype = 'e'
    `;

		for (const type of types) {
			await sql.unsafe(`DROP TYPE IF EXISTS "${type.typname}" CASCADE`);
			console.log(`  ✅ Dropped type ${type.typname}`);
		}

		await sql.end();

		console.log("\n╔════════════════════════════════════════════════╗");
		console.log("║  ✅ Database reset completed!                  ║");
		console.log("╠════════════════════════════════════════════════╣");
		console.log("║  Next steps:                                   ║");
		console.log("║  1. Run migrations: pnpm run db:migrate       ║");
		console.log("║  2. Check status: pnpm run db:status          ║");
		console.log("╚════════════════════════════════════════════════╝");
	} catch (error) {
		console.error("\n❌ Reset failed:", error.message);
		console.error("Error details:", error);
		process.exit(1);
	} finally {
		await sql.end();
	}
}

resetDatabase();
