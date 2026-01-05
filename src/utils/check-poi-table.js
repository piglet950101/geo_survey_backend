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

async function checkPOITable() {
  try {
    // Check if ts_poi exists
    const tsPoiCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'ts_poi'
    `);
    
    if (tsPoiCheck.rows.length > 0) {
      console.log('✅ ts_poi table exists');
      const columns = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'ts_poi'
        ORDER BY ordinal_position
      `);
      console.log('Columns:');
      columns.rows.forEach(col => console.log(`  - ${col.column_name}: ${col.data_type}`));
    } else {
      console.log('❌ ts_poi table does not exist');
    }
    
    // Check ts_overture_poi_3
    const overtureCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'ts_overture_poi_3'
    `);
    
    if (overtureCheck.rows.length > 0) {
      console.log('\n✅ ts_overture_poi_3 table exists');
      const columns = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'ts_overture_poi_3'
        ORDER BY ordinal_position
      `);
      console.log('Columns:');
      columns.rows.forEach(col => console.log(`  - ${col.column_name}: ${col.data_type}`));
      
      // Get sample data
      const sample = await pool.query('SELECT * FROM ts_overture_poi_3 LIMIT 1');
      if (sample.rows.length > 0) {
        console.log('\nSample row keys:', Object.keys(sample.rows[0]).join(', '));
      }
    } else {
      console.log('\n❌ ts_overture_poi_3 table does not exist');
    }
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkPOITable();

