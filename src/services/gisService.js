import pool from '../config/database.js';

/**
 * GIS Analysis Service
 * Analyzes survey locations using PostGIS and calculates:
 * - POIs within 10-minute walking radius (Mapbox Isochrone API with 1000m fallback)
 * - Distances to nearest police, hospital, main road
 * - Development score based on amenities
 * - FTL zone percentage (tank overlap)
 * 
 * Based on original Base44 analyzeSurvey function
 */

const ISO_MINUTES = 10;
const DENOISE = 1;
const FALLBACK_WALK_BUFFER_M = 1000;
const SUPPORTIVE_CATEGORIES = ["Retail", "Health And Medical", "Accommodation"];

class GISService {
  /**
   * Analyze survey location
   * @param {string} village - Village name
   * @param {string} surveyNumber - Survey number
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeLocation(village, surveyNumber) {
    try {
      console.log(`🔍 Analyzing location: ${village}, Survey #${surveyNumber}`);

      // Step 1: Get coordinates from ts_warangal_survey_centroids (matching original)
      const surveyResult = await pool.query(
        `SELECT 
                ST_X(geom) as longitude,
                ST_Y(geom) as latitude,
                ST_AsGeoJSON(geom) as geom_json
         FROM ts_warangal_survey_centroids
         WHERE village = $1 AND surveyno = $2
         LIMIT 1`,
        [village, surveyNumber]
      );

      if (surveyResult.rows.length === 0) {
        return { error: `No matching survey centroid found. Check village and survey number.` };
      }

      const survey = surveyResult.rows[0];
      const latitude = parseFloat(survey.latitude);
      const longitude = parseFloat(survey.longitude);

      console.log(`📍 Survey location: ${latitude}, ${longitude}`);

      // Step 2: Get isochrone using Mapbox API (matching original)
      const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;
      let isoGeometry;
      let usedFallback = false;

      if (!MAPBOX_TOKEN) {
        console.error('❌ MAPBOX_TOKEN not set in environment variables!');
        throw new Error('Mapbox token not configured. Please set MAPBOX_TOKEN in environment variables.');
      }

      try {
        const isoUrl = `https://api.mapbox.com/isochrone/v1/mapbox/walking/${longitude},${latitude}?contours_minutes=${ISO_MINUTES}&polygons=true&denoise=${DENOISE}&access_token=${MAPBOX_TOKEN}`;
        console.log(`🗺️  Requesting isochrone from Mapbox API...`);
        console.log(`   URL: ${isoUrl.replace(MAPBOX_TOKEN, '***')}`);
        
        const isoResponse = await fetch(isoUrl);
        
        if (!isoResponse.ok) {
          const errorText = await isoResponse.text();
          console.error(`❌ Mapbox API error (${isoResponse.status}):`, errorText);
          throw new Error(`Mapbox API error: ${isoResponse.status} - ${errorText}`);
        }
        
        const isoData = await isoResponse.json();
        console.log(`📦 Mapbox API response:`, {
          hasFeatures: !!isoData.features,
          featureCount: isoData.features?.length || 0,
          geometryType: isoData.features?.[0]?.geometry?.type
        });
        
        if (isoData.features && isoData.features.length > 0) {
          isoGeometry = isoData.features[0].geometry;
          
          // Validate geometry type (should be Polygon or MultiPolygon, not Point)
          if (isoGeometry.type === 'Polygon' || isoGeometry.type === 'MultiPolygon') {
            console.log(`✅ Isochrone received: ${isoGeometry.type} with ${isoGeometry.coordinates?.[0]?.length || 0} coordinates`);
          } else {
            console.warn(`⚠️  Unexpected geometry type: ${isoGeometry.type}, falling back to buffer`);
            throw new Error(`Unexpected geometry type: ${isoGeometry.type}`);
          }
        } else {
          throw new Error('No isochrone data returned');
        }
      } catch (error) {
        console.warn(`⚠️  Mapbox isochrone failed: ${error.message}`);
        console.log(`   Using ${FALLBACK_WALK_BUFFER_M}m circular buffer fallback.`);
        console.log(`   Note: This will create a circular area instead of a walkable isochrone.`);
        usedFallback = true;
        
        // Fallback to 1000m buffer (matching original)
        const bufferResult = await pool.query(
          `SELECT ST_AsGeoJSON(
            ST_Transform(
              ST_Buffer(
                ST_Transform(geom, 32643),
                $1
              ),
              4326
            )
          ) as buffer_geom
          FROM ts_warangal_survey_centroids
          WHERE village = $2 AND surveyno = $3
          LIMIT 1`,
          [FALLBACK_WALK_BUFFER_M, village, surveyNumber]
        );
        isoGeometry = JSON.parse(bufferResult.rows[0].buffer_geom);
        console.log(`   Fallback buffer geometry type: ${isoGeometry.type}`);
      }

      // Step 3: Get POIs within isochrone (matching original)
      const poiResult = await pool.query(
        `WITH iso AS (
          SELECT ST_GeomFromGeoJSON($1::text) as geom
        )
        SELECT 
          p.category,
          ST_Y(p.geom) as lat,
          ST_X(p.geom) as lon
        FROM ts_overture_poi_3 p, iso
        WHERE ST_Intersects(p.geom, iso.geom)`,
        [JSON.stringify(isoGeometry)]
      );

      // Step 4: Process POI data (matching original exactly)
      const categoryMap = {};
      poiResult.rows.forEach(poi => {
        // Match original: use poi.category directly, no fallback
        if (!categoryMap[poi.category]) {
          categoryMap[poi.category] = [];
        }
        categoryMap[poi.category].push({
          lat: parseFloat(poi.lat),
          lon: parseFloat(poi.lon)
        });
      });

      const totalPois = poiResult.rows.length;
      const poiBreakdown = Object.keys(categoryMap).map(category => ({
        category,
        count: categoryMap[category].length,
        percent: parseFloat(((categoryMap[category].length / totalPois) * 100).toFixed(2)),
        locations: categoryMap[category]
      })).sort((a, b) => b.count - a.count);

      // Supportive businesses subset (matching original exact categories)
      const supportiveBusinesses = poiBreakdown
        .filter(item => SUPPORTIVE_CATEGORIES.includes(item.category))
        .map(item => {
          const supportiveTotal = poiBreakdown
            .filter(i => SUPPORTIVE_CATEGORIES.includes(i.category))
            .reduce((sum, i) => sum + i.count, 0);
          return {
            category: item.category,
            count: item.count,
            percent: parseFloat(((item.count / supportiveTotal) * 100).toFixed(2))
          };
        });

      // Step 5: Get nearest features (matching original helper function)
      const getNearestFeature = async (tableName) => {
        // Use parameterized query with table name validation
        const validTables = ['ts_policestations', 'ts_hospitals', 'ts_main_roads'];
        if (!validTables.includes(tableName)) {
          throw new Error(`Invalid table name: ${tableName}`);
        }
        
        const result = await pool.query(
          `WITH survey AS (
            SELECT geom
            FROM ts_warangal_survey_centroids
            WHERE village = $1 AND surveyno = $2
            LIMIT 1
          )
          SELECT
            ST_Distance(s.geom::geography, f.geom::geography) AS dist_m,
            ST_Y(f.geom) as lat,
            ST_X(f.geom) as lon
          FROM survey s
          CROSS JOIN LATERAL (
            SELECT geom
            FROM ${tableName}
            ORDER BY s.geom <-> geom
            LIMIT 1
          ) f`,
          [village, surveyNumber]
        );
        
        if (result.rows.length === 0) return null;
        return {
          distance_m: parseFloat(result.rows[0].dist_m),
          lat: parseFloat(result.rows[0].lat),
          lon: parseFloat(result.rows[0].lon)
        };
      };

      const policeData = await getNearestFeature('ts_policestations');
      const hospitalData = await getNearestFeature('ts_hospitals');
      const roadData = await getNearestFeature('ts_main_roads');

      // Step 6: Calculate FTL zone intersection with isochrone (matching original)
      const ftlResult = await pool.query(
        `WITH iso AS (
          SELECT ST_GeomFromGeoJSON($1::text) as geom
        ),
        intersections AS (
          SELECT 
            ST_Area(ST_Intersection(iso.geom::geography, t.geom::geography)) as intersection_area,
            ST_Area(iso.geom::geography) as total_area
          FROM iso
          CROSS JOIN ts_tanks t
          WHERE ST_Intersects(iso.geom, t.geom)
        )
        SELECT 
          COALESCE(SUM(intersection_area), 0) as total_intersection,
          MAX(total_area) as isochrone_area
        FROM intersections`,
        [JSON.stringify(isoGeometry)]
      );

      let ftlPercentage = 0;
      if (ftlResult.rows.length > 0 && ftlResult.rows[0].isochrone_area > 0) {
        const rawPercentage = (ftlResult.rows[0].total_intersection / ftlResult.rows[0].isochrone_area) * 100;
        // Apply 9% threshold and round (matching original)
        ftlPercentage = rawPercentage > 9 ? Math.round(rawPercentage) : 0;
      }

      // Get intersecting tank geometries for map display (matching original)
      const tanksGeometry = await pool.query(
        `WITH iso AS (
          SELECT ST_GeomFromGeoJSON($1::text) as geom
        )
        SELECT json_build_object(
          'type', 'FeatureCollection',
          'features', json_agg(
            json_build_object(
              'type', 'Feature',
              'geometry', ST_AsGeoJSON(t.geom)::json
            )
          )
        ) as geojson
        FROM iso
        CROSS JOIN ts_tanks t
        WHERE ST_Intersects(iso.geom, t.geom)`,
        [JSON.stringify(isoGeometry)]
      );

      let tanksGeoJSON = null;
      if (tanksGeometry.rows.length > 0 && tanksGeometry.rows[0].geojson) {
        tanksGeoJSON = tanksGeometry.rows[0].geojson;
      }

      // Step 7: Calculate Development Score (matching original formulas exactly)
      const poiScore = Math.min(30, (totalPois / 100) * 30); // Max 30 points
      
      const amenityScore = (() => {
        let score = 0;
        if (policeData) score += Math.max(0, 10 - (policeData.distance_m / 1000)); // Up to 10 points
        if (hospitalData) score += Math.max(0, 10 - (hospitalData.distance_m / 1000)); // Up to 10 points
        if (roadData) score += Math.max(0, 5 - (roadData.distance_m / 1000)); // Up to 5 points
        return Math.min(25, score);
      })();
      
      const ftlScore = ftlPercentage === 0 ? 20 : Math.max(0, 20 - (ftlPercentage / 5)); // Max 20, decreases with FTL risk
      
      const supportiveTotal = supportiveBusinesses.reduce((sum, b) => sum + b.count, 0);
      const businessScore = Math.min(15, (supportiveTotal / 20) * 15); // Max 15 points
      
      const categoryCount = Object.keys(categoryMap).length;
      const accessibilityScore = Math.min(10, (categoryCount / 15) * 10); // Max 10 points based on POI diversity
      
      const developmentScore = Math.round(poiScore + amenityScore + ftlScore + businessScore + accessibilityScore);
      
      // Ensure scores don't exceed their maximums (safety check)
      const scoreBreakdown = {
        poi_score: Math.min(30, parseFloat(poiScore.toFixed(1))),
        amenity_score: Math.min(25, parseFloat(amenityScore.toFixed(1))),
        ftl_score: Math.min(20, parseFloat(ftlScore.toFixed(1))),
        business_score: Math.min(15, parseFloat(businessScore.toFixed(1))),
        accessibility_score: Math.min(10, parseFloat(accessibilityScore.toFixed(1)))
      };

      console.log(`✅ Analysis complete: ${totalPois} POIs, Score: ${developmentScore}`);
      console.log(`📊 Score Breakdown:`, JSON.stringify(scoreBreakdown, null, 2));
      console.log(`🔄 Used Fallback: ${usedFallback}`);
      console.log(`📍 Location: ${village}, Survey #${surveyNumber}`);

      // Step 8: Return complete analysis result (matching original structure)
      return {
        village,
        survey_number: surveyNumber,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        total_pois: totalPois,
        poi_breakdown: poiBreakdown,
        distance_to_police: policeData ? parseFloat((policeData.distance_m / 1000).toFixed(3)) : null,
        distance_to_hospital: hospitalData ? parseFloat((hospitalData.distance_m / 1000).toFixed(3)) : null,
        distance_to_main_road: roadData ? parseFloat((roadData.distance_m / 1000).toFixed(3)) : null,
        supportive_businesses: supportiveBusinesses,
        ftl_zone_percentage: ftlPercentage,
        development_score: developmentScore,
        score_breakdown: scoreBreakdown,
        used_fallback: usedFallback,
        analysis_date: new Date().toISOString(),
        map_data: {
          isochrone_geometry: isoGeometry,
          poi_locations: poiBreakdown, // POI locations are in poi_breakdown
          nearest_police: policeData,
          nearest_hospital: hospitalData,
          nearest_road: roadData,
          tanks_geometry: tanksGeoJSON
        }
      };
    } catch (error) {
      console.error('❌ GIS analysis error:', error);
      return { error: error.message || 'GIS analysis failed' };
    }
  }

}

export const gisService = new GISService();
