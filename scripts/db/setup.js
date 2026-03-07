import pg from "pg";
import { config } from "./config.js";

/**
 * Database setup script
 * Creates the database if it doesn't exist
 */

async function setupDatabase() {
	console.log("🔧 Setting up database...\n");
	console.log(`Host: ${config.host}:${config.port}`);
	console.log(`User: ${config.user}`);
	console.log(`Database: ${config.database}\n`);

	const dbName = config.database;

	// Connect to postgres database (default database)
	const pool = new pg.Pool({
		...config,
		database: "postgres", // Connect to default postgres database
	});

	try {
		// Check if database exists
		console.log(`1. Checking if database "${dbName}" exists...`);
		const result = await pool.query(
			"SELECT 1 FROM pg_database WHERE datname = $1",
			[dbName],
		);

		if (result.rows.length > 0) {
			console.log(`✅ Database "${dbName}" already exists\n`);
		} else {
			// Create database
			console.log(`📦 Creating database "${dbName}"...`);
			await pool.query(`CREATE DATABASE "${dbName}"`);
			console.log(`✅ Database "${dbName}" created successfully\n`);
		}

		await pool.end();

		// Test connection to new database
		console.log("2. Testing connection to database...");
		const testPool = new pg.Pool(config);
		await testPool.query("SELECT 1");
		console.log("✅ Connection test successful\n");
		await testPool.end();

		console.log("╔════════════════════════════════════════════════╗");
		console.log("║  🎉 Database setup completed!                  ║");
		console.log("╠════════════════════════════════════════════════╣");
		console.log("║  Next steps:                                   ║");
		console.log("║  1. Run migrations: pnpm run db:migrate        ║");
		console.log("║  2. Check status: pnpm run db:status           ║");
		console.log("║  3. (Optional) Seed data: pnpm run db:seed     ║");
		console.log("╚════════════════════════════════════════════════╝");
	} catch (error) {
		console.error("❌ Database setup failed:", error.message);
		console.error("\nTroubleshooting:");
		console.error("1. Make sure PostgreSQL is running");
		console.error("2. Check your .env file for correct credentials");
		console.error("3. Verify user has CREATE DATABASE permission");
		console.error("\nTo grant permissions:");
		console.error(
			`   psql -U postgres -c "ALTER USER ${config.user} CREATEDB;"`,
		);
		process.exit(1);
	} finally {
		await pool.end().catch(() => {});
	}
}

setupDatabase();
