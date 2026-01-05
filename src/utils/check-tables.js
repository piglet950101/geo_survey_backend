import pool from '../config/database.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkTables() {
  try {
    const tables = ['ts_poi', 'ts_hospitals', 'ts_policestations', 'ts_main_roads', 'ts_tanks'];
    
    for (const table of tables) {
      console.log(`\n📋 ${table}:`);
      const result = await pool.query(
        `SELECT column_name, data_type 
         FROM information_schema.columns 
         WHERE table_name = $1 
         ORDER BY ordinal_position`,
        [table]
      );
      
      if (result.rows.length === 0) {
        console.log('   ❌ Table not found');
      } else {
        result.rows.forEach(col => {
          console.log(`   - ${col.column_name}: ${col.data_type}`);
        });
        
        // Get sample data
        const sample = await pool.query(`SELECT * FROM ${table} LIMIT 1`);
        if (sample.rows.length > 0) {
          console.log(`   Sample keys: ${Object.keys(sample.rows[0]).join(', ')}`);
        }
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkTables();



