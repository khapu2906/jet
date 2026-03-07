import postgres from "postgres";
import "dotenv/config";

const config = {
	host: process.env.DB_HOST || "localhost",
	port: parseInt(process.env.DB_PORT || "5432"),
	username: process.env.DB_USER || "postgres",
	password: process.env.DB_PASSWORD || "postgres",
	database: process.env.DB_NAME || "jet-db",
};

async function testDatabaseConnection() {
	console.log("🧪 Testing database connection...\n");
	console.log("Configuration:");
	console.log(`  Host: ${config.host}`);
	console.log(`  Port: ${config.port}`);
	console.log(`  User: ${config.username}`);
	console.log(`  Database: ${config.database}\n`);

	const sql = postgres(config);

	try {
		// Test 1: Basic connection
		console.log("1. Testing basic connection...");
		const result = await sql`SELECT NOW() as current_time, version()`;
		console.log("✅ Connection successful");
		console.log(`   Server time: ${result[0].current_time}`);
		console.log(`   PostgreSQL version: ${result[0].version.split(",")[0]}\n`);

		// Test 2: Check database exists
		console.log("2. Checking database...");
		const dbCheck = await sql`SELECT current_database()`;
		console.log(`✅ Connected to database: ${dbCheck[0].current_database}\n`);

		// Test 3: List tables
		console.log("3. Checking tables...");
		const tables = await sql`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `;
		console.log(`✅ Found ${tables[0].count} table(s) in public schema\n`);

		// Test 4: Check permissions
		console.log("4. Checking user permissions...");
		const permissions = await sql`
      SELECT
        has_database_privilege(current_user, current_database(), 'CREATE') as can_create,
        has_database_privilege(current_user, current_database(), 'CONNECT') as can_connect,
        has_database_privilege(current_user, current_database(), 'TEMPORARY') as can_temp
    `;
		console.log(`✅ CREATE permission: ${permissions[0].can_create}`);
		console.log(`✅ CONNECT permission: ${permissions[0].can_connect}`);
		console.log(`✅ TEMPORARY permission: ${permissions[0].can_temp}\n`);

		// Test 5: Simple query
		console.log("5. Testing simple query...");
		const mathTest = await sql`SELECT 1 + 1 as result`;
		console.log(`✅ Query executed: 1 + 1 = ${mathTest[0].result}\n`);

		await sql.end();

		console.log("╔════════════════════════════════════════════════╗");
		console.log("║  ✅ All database tests passed!                 ║");
		console.log("╠════════════════════════════════════════════════╣");
		console.log("║  Your database connection is working correctly ║");
		console.log("╚════════════════════════════════════════════════╝");
	} catch (error) {
		console.error("\n❌ Database test failed!\n");

		if (error.code === "ECONNREFUSED") {
			console.error("🔴 Connection refused");
			console.error("   PostgreSQL is not running or not accessible\n");
			console.error("Solutions:");
			console.error("  • Start PostgreSQL: brew services start postgresql");
			console.error("  • Check if PostgreSQL is running: pg_isready");
			console.error("  • Verify host and port in .env file");
		} else if (error.code === "3D000") {
			console.error(`🔴 Database "${config.database}" does not exist\n`);
			console.error("Solutions:");
			console.error("  • Run setup: pnpm run db:setup");
			console.error(`  • Create manually: createdb ${config.database}`);
		} else if (error.code === "28P01") {
			console.error("🔴 Authentication failed\n");
			console.error("Solutions:");
			console.error("  • Check DB_USER and DB_PASSWORD in .env file");
			console.error("  • Verify PostgreSQL authentication settings");
		} else if (error.code === "28000") {
			console.error("🔴 Invalid authorization specification\n");
			console.error("Solutions:");
			console.error("  • Check DB_PASSWORD in .env file");
			console.error("  • Verify user exists in PostgreSQL");
		} else {
			console.error("Error code:", error.code);
			console.error("Error message:", error.message);
			console.error("\nFull error:", error);
		}

		process.exit(1);
	} finally {
		await sql.end();
	}
}

testDatabaseConnection();
