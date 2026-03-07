import postgres from 'postgres';
import 'dotenv/config';

/**
 * Database setup script
 * Creates the database if it doesn't exist
 */

const host = process.env.DB_HOST || 'localhost';
const port = parseInt(process.env.DB_PORT || '5432');
const user = process.env.DB_USER || 'postgres';
const password = process.env.DB_PASSWORD || 'postgres';
const dbName = process.env.DB_NAME || 'Flint-ai-db';

async function setupDatabase() {
  console.log('🔧 Setting up database...\n');
  console.log(`Host: ${host}:${port}`);
  console.log(`User: ${user}`);
  console.log(`Database: ${dbName}\n`);

  // Connect to postgres database (default database)
  const sql = postgres({
    host,
    port,
    username: user,
    password,
    database: 'postgres', // Connect to default postgres database
  });

  try {
    // Check if database exists
    console.log(`1. Checking if database "${dbName}" exists...`);
    const result = await sql`
      SELECT 1 FROM pg_database WHERE datname = ${dbName}
    `;

    if (result.length > 0) {
      console.log(`✅ Database "${dbName}" already exists\n`);
    } else {
      // Create database
      console.log(`📦 Creating database "${dbName}"...`);
      await sql.unsafe(`CREATE DATABASE ${dbName}`);
      console.log(`✅ Database "${dbName}" created successfully\n`);
    }

    // Test connection to new database
    console.log('2. Testing connection to database...');
    await sql.end();

    const testSql = postgres({
      host,
      port,
      username: user,
      password,
      database: dbName,
    });

    await testSql`SELECT 1`;
    console.log('✅ Connection test successful\n');

    await testSql.end();

    console.log('╔════════════════════════════════════════════════╗');
    console.log('║  🎉 Database setup completed!                  ║');
    console.log('╠════════════════════════════════════════════════╣');
    console.log('║  Next steps:                                   ║');
    console.log('║  1. Run migrations: pnpm run db:migrate       ║');
    console.log('║  2. Check status: pnpm run db:status          ║');
    console.log('║  3. (Optional) Seed data: pnpm run db:seed    ║');
    console.log('╚════════════════════════════════════════════════╝');
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure PostgreSQL is running');
    console.error('2. Check your .env file for correct credentials');
    console.error('3. Verify user has CREATE DATABASE permission');
    console.error('\nTo grant permissions:');
    console.error(
      `   psql -U postgres -c "ALTER USER ${user} CREATEDB;"`
    );
    process.exit(1);
  } finally {
    await sql.end();
  }
}

setupDatabase();
