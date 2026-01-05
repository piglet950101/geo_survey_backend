import pool from '../config/database.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Test INSERT permissions on existing tables
 */
async function testInserts() {
  try {
    console.log('🧪 Testing INSERT permissions...\n');

    // Test 1: Check users_user table structure
    console.log('📋 Checking users_user table structure...');
    const userColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'users_user'
      ORDER BY ordinal_position;
    `);
    console.log('users_user columns:');
    userColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    console.log('\n');

    // Test 2: Check ts_warangal_survey table structure
    console.log('📋 Checking ts_warangal_survey table structure...');
    const surveyColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'ts_warangal_survey'
      ORDER BY ordinal_position;
    `);
    console.log('ts_warangal_survey columns:');
    surveyColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    console.log('\n');

    // Test 3: Try INSERT into users_user (with rollback)
    console.log('🧪 Testing INSERT into users_user...');
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Generate test UUID
      const testId = '00000000-0000-0000-0000-000000000001';
      const testEmail = `test_${Date.now()}@test.com`;
      
      const insertResult = await client.query(`
        INSERT INTO users_user (
          id, username, email, password, first_name, last_name,
          is_superuser, is_staff, is_active, date_joined
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING id, username, email
      `, [
        testId,
        testEmail.split('@')[0],
        testEmail,
        'pbkdf2_sha256$test$test', // Django password hash format
        'Test',
        'User',
        false,
        false,
        true
      ]);
      
      console.log('✅ INSERT into users_user SUCCESSFUL!');
      console.log('   Inserted:', insertResult.rows[0]);
      
      // Rollback the test insert
      await client.query('ROLLBACK');
      console.log('   (Rolled back test insert)\n');
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.log('❌ INSERT into users_user FAILED:');
      console.log('   Error:', error.message);
      console.log('   Code:', error.code);
      console.log('\n');
    } finally {
      client.release();
    }

    // Test 4: Try INSERT into ts_warangal_survey (with rollback)
    console.log('🧪 Testing INSERT into ts_warangal_survey...');
    const client2 = await pool.connect();
    
    try {
      await client2.query('BEGIN');
      
      const insertResult = await client2.query(`
        INSERT INTO ts_warangal_survey (surveyno, village, geom)
        VALUES ($1, $2, ST_SetSRID(ST_MakePoint(0, 0), 4326))
        RETURNING gid, surveyno, village
      `, [
        'TEST_' + Date.now(),
        'Test Village'
      ]);
      
      console.log('✅ INSERT into ts_warangal_survey SUCCESSFUL!');
      console.log('   Inserted:', insertResult.rows[0]);
      
      // Rollback the test insert
      await client2.query('ROLLBACK');
      console.log('   (Rolled back test insert)\n');
      
    } catch (error) {
      await client2.query('ROLLBACK');
      console.log('❌ INSERT into ts_warangal_survey FAILED:');
      console.log('   Error:', error.message);
      console.log('   Code:', error.code);
      console.log('\n');
    } finally {
      client2.release();
    }

    console.log('✅ Insert permission testing complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testInserts();



