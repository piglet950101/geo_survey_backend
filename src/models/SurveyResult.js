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
      map_data,
      used_fallback
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
      used_fallback: used_fallback || false, // Include used_fallback flag
      analysis_date: new Date().toISOString()
    };
    
    console.log(`💾 Storing analysis for gid=${row.gid}:`, {
      scoreBreakdown: score_breakdown,
      developmentScore: development_score,
      usedFallback: analysisData.used_fallback
    });
    
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
    let analysisData = AnalysisStore.get(row.gid) || {};
    
    // Transform old score_breakdown format to new format if needed
    if (analysisData.score_breakdown) {
      const oldBreakdown = analysisData.score_breakdown;
      
      // Check if it's in old format (has police_distance_score, etc.)
      if (oldBreakdown.police_distance_score !== undefined || 
          oldBreakdown.supportive_businesses_score !== undefined || 
          oldBreakdown.ftl_penalty !== undefined ||
          !oldBreakdown.amenity_score) {  // Also check if new format fields are missing
        console.log(`🔄 Converting old score_breakdown format for gid=${row.gid}`);
        console.log(`   Old format:`, JSON.stringify(oldBreakdown, null, 2));
        
        // Convert old format to new format
        const newBreakdown = {
          poi_score: Math.min(30, oldBreakdown.poi_score || 0),
          amenity_score: Math.min(25, (oldBreakdown.police_distance_score || 0) + 
                                    (oldBreakdown.hospital_distance_score || 0) + 
                                    (oldBreakdown.road_distance_score || 0)),
          ftl_score: oldBreakdown.ftl_score !== undefined 
            ? Math.min(20, oldBreakdown.ftl_score) 
            : (oldBreakdown.ftl_penalty !== undefined 
                ? Math.min(20, Math.max(0, 20 - oldBreakdown.ftl_penalty)) 
                : 0),
          business_score: Math.min(15, oldBreakdown.supportive_businesses_score || 0),
          accessibility_score: Math.min(10, oldBreakdown.accessibility_score || 0)
        };
        
        console.log(`   New format:`, JSON.stringify(newBreakdown, null, 2));
        
        analysisData = {
          ...analysisData,
          score_breakdown: newBreakdown
        };
        
        // Update in store with new format
        AnalysisStore.set(row.gid, analysisData);
      }
    }
    
    // Log for debugging
    console.log(`📊 Retrieving analysis for gid=${row.gid}:`, {
      hasAnalysisData: !!analysisData.score_breakdown,
      scoreBreakdown: analysisData.score_breakdown,
      developmentScore: analysisData.development_score,
      usedFallback: analysisData.used_fallback
    });
    
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
    // If filtering by id, use findById which includes analysis data
    if (filters.id) {
      const result = await this.findById(filters.id);
      return result ? [result] : [];
    }

    let query = `SELECT gid, surveyno, village, geom,
                        ST_X(ST_Centroid(geom)) as longitude,
                        ST_Y(ST_Centroid(geom)) as latitude
                 FROM ts_warangal_survey WHERE 1=1`;
    const params = [];
    let paramCount = 1;

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

    // Transform to expected format and include analysis data if available
    return result.rows.map(row => {
      let analysisData = AnalysisStore.get(row.gid) || {};
      
      // Transform old score_breakdown format to new format if needed
      if (analysisData.score_breakdown) {
        const oldBreakdown = analysisData.score_breakdown;
        
        // Check if it's in old format
        if (oldBreakdown.police_distance_score !== undefined || 
            oldBreakdown.supportive_businesses_score !== undefined || 
            oldBreakdown.ftl_penalty !== undefined ||
            !oldBreakdown.amenity_score) {
          console.log(`🔄 Converting old format in find() for gid=${row.gid}`);
          const newBreakdown = {
            poi_score: Math.min(30, oldBreakdown.poi_score || 0),
            amenity_score: Math.min(25, (oldBreakdown.police_distance_score || 0) + 
                                      (oldBreakdown.hospital_distance_score || 0) + 
                                      (oldBreakdown.road_distance_score || 0)),
            ftl_score: oldBreakdown.ftl_score !== undefined 
              ? Math.min(20, oldBreakdown.ftl_score) 
              : (oldBreakdown.ftl_penalty !== undefined 
                  ? Math.min(20, Math.max(0, 20 - oldBreakdown.ftl_penalty)) 
                  : 0),
            business_score: Math.min(15, oldBreakdown.supportive_businesses_score || 0),
            accessibility_score: Math.min(10, oldBreakdown.accessibility_score || 0)
          };
          
          analysisData = {
            ...analysisData,
            score_breakdown: newBreakdown
          };
          
          // Update in store
          AnalysisStore.set(row.gid, analysisData);
        }
      }
      
      return {
        id: row.gid.toString(),
        gid: row.gid,
        village: row.village,
        survey_number: row.surveyno,
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude),
        ...analysisData
      };
    });
  }
}

