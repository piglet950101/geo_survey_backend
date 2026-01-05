import pool from '../config/database.js';
import dotenv from 'dotenv';

dotenv.config();

async function testGeometry() {
  try {
    console.log('🧪 Testing MultiPolygon geometry creation...\n');
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Test geometry creation
      // Create a point, buffer it (in meters), then convert to MultiPolygon
      const bufferRadiusMeters = 100; // 100 meters
      const result = await client.query(
        `INSERT INTO ts_warangal_survey (surveyno, village, geom)
         VALUES ($1, $2, ST_Multi(
           ST_Buffer(
             ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
             $5
           )::geometry
         ))
         RETURNING gid, surveyno, village`,
        ['TEST_' + Date.now(), 'Test Village', 79.5, 17.9, bufferRadiusMeters]
      );
      
      console.log('✅ Geometry test successful!');
      console.log('   GID:', result.rows[0].gid);
      console.log('   Survey No:', result.rows[0].surveyno);
      console.log('   Village:', result.rows[0].village);
      
      // Verify geometry type
      const geomCheck = await client.query(
        `SELECT ST_GeometryType(geom) as geom_type, ST_AsText(geom) as geom_text
         FROM ts_warangal_survey WHERE gid = $1`,
        [result.rows[0].gid]
      );
      
      console.log('   Geometry Type:', geomCheck.rows[0].geom_type);
      console.log('   Geometry (first 100 chars):', geomCheck.rows[0].geom_text.substring(0, 100) + '...');
      
      // Rollback
      await client.query('ROLLBACK');
      console.log('\n   (Test record rolled back)');
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Geometry test failed:');
      console.error('   Error:', error.message);
      console.error('   Code:', error.code);
      throw error;
    } finally {
      client.release();
    }
    
    console.log('\n✅ Geometry test complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testGeometry();

