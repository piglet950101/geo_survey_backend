import pool from '../config/database.js';
import { AnalysisStore } from '../services/analysisStore.js';

/**
 * SurveyResult Model - Uses existing ts_warangal_survey table
 * 
 * Table structure:
 * - gid: integer (primary key, auto-increment)
 * - surveyno: varchar (survey number)
 * - village: varchar (village name)
 * - geom: MultiPolygon (PostGIS geometry)
 * 
 * NOTE: This table only stores basic survey info (surveyno, village, geom).
 * Analysis results (POIs, distances, scores) are stored in AnalysisStore (in-memory).
 */
export class SurveyResult {
  /**
   * Create new survey result
   * Note: ts_warangal_survey only has: gid, surveyno, village, geom
   * Analysis data (POIs, distances, etc.) needs separate storage
   */
  static async create(data) {
    const {
      village,
      survey_number,
      latitude,
      longitude,
      // Analysis data - will be stored separately or returned in response
      total_pois,
      poi_breakdown,
      supportive_businesses,
      distance_to_police,
      distance_to_hospital,
      distance_to_main_road,
      development_score,
      score_breakdown,
      ftl_zone_percentage,
      map_data
    } = data;

    // Create a point geometry from lat/lon, then buffer it to create a MultiPolygon
    // Since ts_warangal_survey expects MultiPolygon, we'll create a small buffer around the point
    // Buffer radius: 100 meters (using geography for accurate distance)
    // ST_Multi wraps the polygon to make it a MultiPolygon
    const bufferRadiusMeters = 100; // 100 meters
    
    const result = await pool.query(
      `INSERT INTO ts_warangal_survey (surveyno, village, geom)
       VALUES ($1, $2, ST_Multi(
         ST_Buffer(
           ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
           $5
         )::geometry
       ))
       RETURNING gid, surveyno, village`,
      [survey_number, village, longitude, latitude, bufferRadiusMeters]
    );

    const row = result.rows[0];
    
    // Extract center point from geometry for lat/lon
    const centerResult = await pool.query(
      `SELECT ST_X(ST_Centroid(geom)) as lon, ST_Y(ST_Centroid(geom)) as lat 
       FROM ts_warangal_survey WHERE gid = $1`,
      [row.gid]
    );
    
    const center = centerResult.rows[0];
    
    // Store analysis data in memory (since DB table doesn't have these fields)
    const analysisData = {
      total_pois,
      poi_breakdown,
      supportive_businesses,
      distance_to_police,
      distance_to_hospital,
      distance_to_main_road,
      development_score,
      score_breakdown,
      ftl_zone_percentage,
      map_data,
      analysis_date: new Date().toISOString()
    };
    
    AnalysisStore.set(row.gid, analysisData);
    
    // Return data in expected format (matching old survey_results structure)
    return {
      id: row.gid.toString(), // Use gid as id for compatibility
      gid: row.gid,
      village: row.village,
      survey_number: row.surveyno,
      latitude: parseFloat(center.lat),
      longitude: parseFloat(center.lon),
      ...analysisData
    };
  }

  /**
   * Find survey result by ID (gid)
   */
  static async findById(id) {
    const result = await pool.query(
      `SELECT gid, surveyno, village, geom,
              ST_X(ST_Centroid(geom)) as longitude,
              ST_Y(ST_Centroid(geom)) as latitude
       FROM ts_warangal_survey WHERE gid = $1`,
      [id]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    
    // Get analysis data from memory store
    const analysisData = AnalysisStore.get(row.gid) || {};
    
    // Return in expected format
    return {
      id: row.gid.toString(),
      gid: row.gid,
      village: row.village,
      survey_number: row.surveyno,
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
      ...analysisData
    };
  }

  /**
   * Find survey results by filters
   */
  static async find(filters = {}) {
    let query = `SELECT gid, surveyno, village, geom,
                        ST_X(ST_Centroid(geom)) as longitude,
                        ST_Y(ST_Centroid(geom)) as latitude
                 FROM ts_warangal_survey WHERE 1=1`;
    const params = [];
    let paramCount = 1;

    if (filters.id) {
      query += ` AND gid = $${paramCount++}`;
      params.push(parseInt(filters.id));
    }

    if (filters.survey_number || filters.surveyno) {
      query += ` AND surveyno = $${paramCount++}`;
      params.push(filters.survey_number || filters.surveyno);
    }

    if (filters.village) {
      query += ` AND village = $${paramCount++}`;
      params.push(filters.village);
    }

    query += ' ORDER BY gid DESC';

    const result = await pool.query(query, params);

    // Transform to expected format
    return result.rows.map(row => ({
      id: row.gid.toString(),
      gid: row.gid,
      village: row.village,
      survey_number: row.surveyno,
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
    }));
  }
}

