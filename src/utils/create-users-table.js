import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: process.env.DATABASE_PORT || 5432,
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  ssl: false,
});

async function createUsersTable() {
  try {
    console.log('🔍 Attempting to create users_user table...\n');
    
    // Check if table already exists
    const checkTable = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'users_user'
    `);
    
    if (checkTable.rows.length > 0) {
      console.log('✅ users_user table already exists!');
      await pool.end();
      process.exit(0);
    }
    
    // Create the table
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS users_user (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(150) NOT NULL UNIQUE,
        email VARCHAR(150) NOT NULL UNIQUE,
        password VARCHAR(128) NOT NULL,
        first_name VARCHAR(30) NOT NULL,
        last_name VARCHAR(150) NOT NULL,
        is_superuser BOOLEAN NOT NULL DEFAULT FALSE,
        is_staff BOOLEAN NOT NULL DEFAULT FALSE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        date_joined TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        last_login TIMESTAMP WITH TIME ZONE
      );
    `;
    
    await pool.query(createTableSQL);
    console.log('✅ users_user table created successfully!');
    
    // Create indexes
    const createIndexesSQL = `
      CREATE INDEX IF NOT EXISTS idx_users_user_email ON users_user(email);
      CREATE INDEX IF NOT EXISTS idx_users_user_username ON users_user(username);
    `;
    
    await pool.query(createIndexesSQL);
    console.log('✅ Indexes created successfully!');
    
    // Verify table structure
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users_user'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Table structure:');
    columns.rows.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
      console.log(`   - ${col.column_name}: ${col.data_type} ${nullable}${defaultVal}`);
    });
    
    await pool.end();
    console.log('\n✅ Setup complete!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating table:', error.message);
    console.error('   Code:', error.code);
    console.error('\n⚠️  If you don\'t have CREATE permissions, please create the table manually via pgAdmin.');
    console.error('   SQL script is available in guides/DATABASE_SETUP_REQUIRED.md');
    await pool.end();
    process.exit(1);
  }
}

createUsersTable();

