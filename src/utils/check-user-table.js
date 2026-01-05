import pkg from 'pg';

const { Pool } = pkg;

const pool = new Pool({
  host: '52.37.160.0',
  port: 5432,
  database: 'postgis_36_sample',
  user: 'postgres',
  password: 'Gopijogu@12',
  ssl: false,
});

async function checkUserTable() {
  try {
    // Check if users_user exists
    const userTableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'users_user'
    `);
    
    if (userTableCheck.rows.length > 0) {
      console.log('✅ users_user table exists');
      const columns = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'users_user'
        ORDER BY ordinal_position
      `);
      console.log('\nColumns:');
      columns.rows.forEach(col => {
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        console.log(`  - ${col.column_name}: ${col.data_type} (${nullable})`);
      });
    } else {
      console.log('❌ users_user table does not exist');
      console.log('\n⚠️  You may need to create this table or use a different table name.');
      console.log('   The User model expects: id (uuid), username, email, password, first_name, last_name, etc.');
    }
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkUserTable();

