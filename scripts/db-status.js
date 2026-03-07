import postgres from 'postgres';
import 'dotenv/config';

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'Flint-ai-db',
};

const sql = postgres(config);

async function checkDatabaseStatus() {
  console.log('🔍 Checking database and migration status...\n');
  console.log(`Database: ${config.database}@${config.host}:${config.port}\n`);

  try {
    // Check connection
    console.log('1. Testing database connection...');
    await sql`SELECT 1`;
    console.log('✅ Database connection successful\n');

    // Check tables
    console.log('2. Checking tables...');
    const tables = await sql`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `;

    const expectedTables = [
      'users',
      'workouts',
      'groups',
      'group_members',
      'challenges',
      'challenge_participants',
      'challenge_requirements',
      'credit_transactions',
      'payments',
      'subscriptions',
      'payment_methods',
      'webhooks',
    ];

    if (tables.length === 0) {
      console.log('❌ No tables found');
      console.log('⚠️  Run migrations: pnpm run db:migrate\n');
    } else {
      console.log(`Found ${tables.length} tables:`);
      const foundTables = tables.map((t) => t.tablename);

      for (const expectedTable of expectedTables) {
        if (foundTables.includes(expectedTable)) {
          console.log(`  ✅ ${expectedTable}`);
        } else {
          console.log(`  ❌ ${expectedTable} (missing)`);
        }
      }

      // Show unexpected tables
      const unexpectedTables = foundTables.filter(
        (t) =>
          !expectedTables.includes(t) && !t.startsWith('__drizzle')
      );
      if (unexpectedTables.length > 0) {
        console.log('\n  📦 Additional tables:');
        unexpectedTables.forEach((t) => console.log(`     - ${t}`));
      }
    }

    // Check Drizzle migrations
    console.log('\n3. Checking Drizzle migrations...');
    const migrationsTableExists = await sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'drizzle'
        AND table_name = '__drizzle_migrations'
      )
    `;

    if (!migrationsTableExists[0].exists) {
      console.log('❌ Drizzle migrations table does not exist');
      console.log('⚠️  No migrations have been run yet');
      console.log('   Run: pnpm run db:migrate\n');
    } else {
      const migrations = await sql`
        SELECT hash, created_at
        FROM drizzle.__drizzle_migrations
        ORDER BY created_at DESC
      `;

      console.log(`✅ Found ${migrations.length} executed migration(s):`);
      migrations.forEach((m, index) => {
        const date = new Date(parseInt(m.created_at)).toLocaleString();
        console.log(`  ${index + 1}. ${m.hash} (applied at ${date})`);
      });
    }

    // Quick data check
    console.log('\n4. Checking data counts...');
    const tableList = tables.map((t) => t.tablename);

    for (const table of tableList) {
      try {
        if (table.startsWith('__drizzle')) continue;

        const count = await sql.unsafe(
          `SELECT COUNT(*) as count FROM "${table}"`
        );
        const recordCount = count[0].count;

        if (recordCount > 0) {
          console.log(`  📊 ${table}: ${recordCount} record(s)`);
        } else {
          console.log(`  📭 ${table}: empty`);
        }
      } catch (error) {
        console.log(`  ❌ ${table}: Error - ${error.message}`);
      }
    }

    // Check database size
    console.log('\n5. Checking database size...');
    const dbSize = await sql`
      SELECT pg_size_pretty(pg_database_size(${config.database})) as size
    `;
    console.log(`  💾 Database size: ${dbSize[0].size}`);

    await sql.end();

    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║  ✅ Database status check completed!           ║');
    console.log('╚════════════════════════════════════════════════╝');
  } catch (error) {
    console.error('\n❌ Status check failed:', error.message);

    if (error.code === '3D000') {
      console.error('\n⚠️  Database does not exist!');
      console.error('   Run: pnpm run db:setup');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\n⚠️  Cannot connect to PostgreSQL!');
      console.error('   Make sure PostgreSQL is running');
    } else {
      console.error('\nError details:', error);
    }

    process.exit(1);
  }
}

checkDatabaseStatus();
