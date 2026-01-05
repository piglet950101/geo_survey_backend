import pool from '../config/database.js';

/**
 * Discover existing database schema
 * This script queries the database to understand existing table structure
 */
export async function discoverDatabaseSchema() {
  try {
    console.log('🔍 Discovering database schema...\n');

    // Get all tables
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    const tablesResult = await pool.query(tablesQuery);
    const tables = tablesResult.rows.map(row => row.table_name);

    console.log(`📊 Found ${tables.length} tables:`, tables.join(', '));
    console.log('\n');

    const schema = {};

    // Get columns for each table
    for (const tableName of tables) {
      const columnsQuery = `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = $1
        ORDER BY ordinal_position;
      `;

      const columnsResult = await pool.query(columnsQuery, [tableName]);
      schema[tableName] = columnsResult.rows;

      console.log(`📋 Table: ${tableName}`);
      console.log('   Columns:');
      columnsResult.rows.forEach(col => {
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
        const maxLength = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
        console.log(`     - ${col.column_name}: ${col.data_type}${maxLength} ${nullable}${defaultVal}`);
      });
      console.log('\n');
    }

    return { tables, schema };
  } catch (error) {
    console.error('❌ Error discovering database schema:', error);
    throw error;
  }
}

// Run discovery if called directly
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check if this file is being run directly
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('db-discovery.js')) {
  discoverDatabaseSchema()
    .then(() => {
      console.log('✅ Database discovery complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Database discovery failed:', error);
      process.exit(1);
    });
}

