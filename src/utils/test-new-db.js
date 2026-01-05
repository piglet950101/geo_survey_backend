import pkg from 'pg';
import dotenv from 'dotenv';

// Test new database connection
const { Pool } = pkg;

const pool = new Pool({
  host: '52.37.160.0',
  port: 5432,
  database: 'postgis_36_sample',
  user: 'postgres',
  password: 'Gopijogu@12',
  ssl: false,
});

async function testConnection() {
  try {
    console.log('🔍 Testing connection to new database...\n');
    console.log('Host: 52.37.160.0');
    console.log('Database: postgis_36_sample\n');
    
    const result = await pool.query('SELECT current_database(), version()');
    
    console.log('✅ Connection successful!');
    console.log('Database:', result.rows[0].current_database);
    console.log('PostgreSQL version:', result.rows[0].version.split(',')[0]);
    
    // Check if PostGIS is installed
    const postgisCheck = await pool.query("SELECT PostGIS_version()");
    console.log('PostGIS version:', postgisCheck.rows[0].postgis_version);
    
    // List tables
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
      LIMIT 20
    `);
    
    console.log(`\n📊 Found ${tables.rows.length} tables (showing first 20):`);
    tables.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    await pool.end();
    process.exit(1);
  }
}

testConnection();

