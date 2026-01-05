import pool from '../config/database.js';

/**
 * GIS Analysis Service
 * Analyzes survey locations using PostGIS and calculates:
 * - POIs within 10-minute walking radius (800m)
 * - Distances to nearest police, hospital, main road
 * - Development score based on amenities
 * - FTL zone percentage (tank overlap)
 */

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

      // Step 1: Get coordinates from ts_warangal_survey
      const surveyResult = await pool.query(
        `SELECT gid, surveyno, village, geom,
                ST_X(ST_Centroid(geom)) as longitude,
                ST_Y(ST_Centroid(geom)) as latitude
         FROM ts_warangal_survey
         WHERE village = $1 AND surveyno = $2
         LIMIT 1`,
        [village, surveyNumber]
      );

      if (surveyResult.rows.length === 0) {
        return { error: `Survey not found: ${village} - ${surveyNumber}` };
      }

      const survey = surveyResult.rows[0];
      const latitude = parseFloat(survey.latitude);
      const longitude = parseFloat(survey.longitude);

      console.log(`📍 Coordinates: ${latitude}, ${longitude}`);

      // Step 2: Create 10-minute walking radius (800 meters)
      const walkingRadiusMeters = 800; // 10 minutes at 4.8 km/h
      const isochroneResult = await pool.query(
        `SELECT ST_AsGeoJSON(
          ST_Buffer(
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
            $3
          )::geometry
        ) as isochrone_geom`,
        [longitude, latitude, walkingRadiusMeters]
      );

      const isochroneGeometry = JSON.parse(isochroneResult.rows[0].isochrone_geom);
      const isochroneGeom = isochroneResult.rows[0].isochrone_geom;

      // Step 3: Find POIs within radius
      // Using ts_overture_poi_3 table (POI data)
      const poiResult = await pool.query(
        `SELECT 
          category,
          type,
          name,
          ST_X(ST_Centroid(geom)) as lon,
          ST_Y(ST_Centroid(geom)) as lat,
          ST_Distance(
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
            geom::geography
          ) as distance_m
         FROM ts_overture_poi_3
         WHERE ST_DWithin(
           ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
           geom::geography,
           $3
         )
         ORDER BY distance_m
         LIMIT 500`,
        [longitude, latitude, walkingRadiusMeters]
      );

      // Step 4: Process POI data
      const poiBreakdown = {};
      const poiLocations = {};
      const supportiveBusinesses = {
        'Retail': 0,
        'Health': 0,
        'Accommodation': 0
      };

      poiResult.rows.forEach(poi => {
        const category = poi.category || 'Other';
        const type = poi.type || 'Unknown';
        
        // Count by category
        if (!poiBreakdown[category]) {
          poiBreakdown[category] = 0;
        }
        poiBreakdown[category]++;

        // Group by category for map display
        if (!poiLocations[category]) {
          poiLocations[category] = [];
        }
        poiLocations[category].push({
          name: poi.name || `${category} - ${type}`,
          lat: parseFloat(poi.lat),
          lon: parseFloat(poi.lon),
          type: type,
          distance_m: Math.round(parseFloat(poi.distance_m))
        });

        // Count supportive businesses
        const categoryLower = category.toLowerCase();
        if (categoryLower.includes('shop') || categoryLower.includes('store') || 
            categoryLower.includes('market') || categoryLower.includes('retail')) {
          supportiveBusinesses['Retail']++;
        } else if (categoryLower.includes('hospital') || categoryLower.includes('clinic') || 
                   categoryLower.includes('pharmacy') || categoryLower.includes('health')) {
          supportiveBusinesses['Health']++;
        } else if (categoryLower.includes('hotel') || categoryLower.includes('lodging') || 
                   categoryLower.includes('accommodation')) {
          supportiveBusinesses['Accommodation']++;
        }
      });

      // Convert poiBreakdown to array format
      const poiBreakdownArray = Object.entries(poiBreakdown)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count);

      // Convert poiLocations to array format for map
      const poiLocationsArray = Object.entries(poiLocations)
        .map(([category, locations]) => ({
          category,
          locations: locations.slice(0, 100) // Limit to 100 per category for performance
        }));

      // Convert supportive businesses to array
      const supportiveBusinessesArray = Object.entries(supportiveBusinesses)
        .filter(([_, count]) => count > 0)
        .map(([category, count]) => ({ category, count }));

      const totalPOIs = poiResult.rows.length;

      // Step 5: Find nearest police station
      const policeResult = await pool.query(
        `SELECT 
          name,
          ST_X(ST_Centroid(geom)) as lon,
          ST_Y(ST_Centroid(geom)) as lat,
          ST_Distance(
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
            geom::geography
          ) as distance_m
         FROM ts_policestations
         ORDER BY ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography <-> geom::geography
         LIMIT 1`,
        [longitude, latitude]
      );

      const nearestPolice = policeResult.rows.length > 0 ? {
        name: policeResult.rows[0].name || 'Police Station',
        lat: parseFloat(policeResult.rows[0].lat),
        lon: parseFloat(policeResult.rows[0].lon),
        distance_m: Math.round(parseFloat(policeResult.rows[0].distance_m))
      } : null;

      // Step 6: Find nearest hospital
      const hospitalResult = await pool.query(
        `SELECT 
          name,
          ST_X(ST_Centroid(geom)) as lon,
          ST_Y(ST_Centroid(geom)) as lat,
          ST_Distance(
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
            geom::geography
          ) as distance_m
         FROM ts_hospitals
         ORDER BY ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography <-> geom::geography
         LIMIT 1`,
        [longitude, latitude]
      );

      const nearestHospital = hospitalResult.rows.length > 0 ? {
        name: hospitalResult.rows[0].name || 'Hospital',
        lat: parseFloat(hospitalResult.rows[0].lat),
        lon: parseFloat(hospitalResult.rows[0].lon),
        distance_m: Math.round(parseFloat(hospitalResult.rows[0].distance_m))
      } : null;

      // Step 7: Find nearest main road
      const roadResult = await pool.query(
        `SELECT 
          name,
          fclass,
          ST_X(ST_ClosestPoint(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326))) as lon,
          ST_Y(ST_ClosestPoint(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326))) as lat,
          ST_Distance(
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
            geom::geography
          ) as distance_m
         FROM ts_main_roads
         ORDER BY ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography <-> geom::geography
         LIMIT 1`,
        [longitude, latitude]
      );

      const nearestRoad = roadResult.rows.length > 0 ? {
        name: roadResult.rows[0].name || roadResult.rows[0].fclass || 'Main Road',
        lat: parseFloat(roadResult.rows[0].lat),
        lon: parseFloat(roadResult.rows[0].lon),
        distance_m: Math.round(parseFloat(roadResult.rows[0].distance_m))
      } : null;

      // Step 8: Calculate FTL zone percentage (tank overlap)
      // Use the survey geometry directly from the query result
      const tankResult = await pool.query(
        `SELECT 
          ST_Area(
            ST_Intersection(
              (SELECT geom FROM ts_warangal_survey WHERE village = $1 AND surveyno = $2 LIMIT 1)::geography,
              ts_tanks.geom::geography
            )
          ) as intersection_area,
          ST_Area((SELECT geom FROM ts_warangal_survey WHERE village = $1 AND surveyno = $2 LIMIT 1)::geography) as survey_area
         FROM ts_tanks
         WHERE ST_Intersects(
           (SELECT geom FROM ts_warangal_survey WHERE village = $1 AND surveyno = $2 LIMIT 1)::geography,
           ts_tanks.geom::geography
         )`,
        [village, surveyNumber]
      );

      let ftlZonePercentage = 0;
      if (tankResult.rows.length > 0 && tankResult.rows[0].survey_area > 0) {
        const totalIntersectionArea = tankResult.rows.reduce((sum, row) => {
          return sum + (parseFloat(row.intersection_area) || 0);
        }, 0);
        const surveyArea = parseFloat(tankResult.rows[0].survey_area);
        ftlZonePercentage = Math.min(100, (totalIntersectionArea / surveyArea) * 100);
      }

      // Get tank geometry for map display
      const tankGeomResult = await pool.query(
        `SELECT ST_AsGeoJSON(ST_Union(ts_tanks.geom)) as tanks_geom
         FROM ts_tanks
         WHERE ST_Intersects(
           (SELECT geom FROM ts_warangal_survey WHERE village = $1 AND surveyno = $2 LIMIT 1)::geography,
           ts_tanks.geom::geography
         )`,
        [village, surveyNumber]
      );

      const tanksGeometry = tankGeomResult.rows.length > 0 && tankGeomResult.rows[0].tanks_geom
        ? JSON.parse(tankGeomResult.rows[0].tanks_geom)
        : null;

      // Step 9: Calculate development score
      const developmentScore = this.calculateDevelopmentScore({
        totalPOIs,
        poiBreakdown: poiBreakdownArray,
        supportiveBusinesses: supportiveBusinessesArray,
        distanceToPolice: nearestPolice ? nearestPolice.distance_m : null,
        distanceToHospital: nearestHospital ? nearestHospital.distance_m : null,
        distanceToRoad: nearestRoad ? nearestRoad.distance_m : null,
        ftlZonePercentage
      });

      const scoreBreakdown = developmentScore.breakdown;

      console.log(`✅ Analysis complete: ${totalPOIs} POIs, Score: ${developmentScore.score.toFixed(1)}`);

      // Step 10: Return complete analysis result
      return {
        latitude,
        longitude,
        total_pois: totalPOIs,
        poi_breakdown: poiBreakdownArray,
        supportive_businesses: supportiveBusinessesArray,
        distance_to_police: nearestPolice ? nearestPolice.distance_m / 1000 : null, // Convert to km
        distance_to_hospital: nearestHospital ? nearestHospital.distance_m / 1000 : null,
        distance_to_main_road: nearestRoad ? nearestRoad.distance_m / 1000 : null,
        development_score: developmentScore.score,
        score_breakdown: scoreBreakdown,
        ftl_zone_percentage: Math.round(ftlZonePercentage * 10) / 10, // Round to 1 decimal
        map_data: {
          isochrone_geometry: isochroneGeometry,
          tanks_geometry: tanksGeometry,
          poi_locations: poiLocationsArray,
          nearest_police: nearestPolice,
          nearest_hospital: nearestHospital,
          nearest_road: nearestRoad
        }
      };
    } catch (error) {
      console.error('❌ GIS analysis error:', error);
      return { error: error.message || 'GIS analysis failed' };
    }
  }

  /**
   * Calculate development score based on amenities and distances
   * Score range: 0-100
   */
  calculateDevelopmentScore({
    totalPOIs,
    poiBreakdown,
    supportiveBusinesses,
    distanceToPolice,
    distanceToHospital,
    distanceToRoad,
    ftlZonePercentage
  }) {
    let score = 0;
    const breakdown = {};

    // POI Score (0-40 points)
    // More POIs = higher score, max at 50+ POIs
    const poiScore = Math.min(40, (totalPOIs / 50) * 40);
    score += poiScore;
    breakdown.poi_score = Math.round(poiScore * 10) / 10;

    // Supportive Businesses Score (0-20 points)
    const totalSupportive = supportiveBusinesses.reduce((sum, item) => sum + item.count, 0);
    const supportiveScore = Math.min(20, (totalSupportive / 10) * 20);
    score += supportiveScore;
    breakdown.supportive_businesses_score = Math.round(supportiveScore * 10) / 10;

    // Police Distance Score (0-10 points)
    // Closer = better, max score at <1km
    let policeScore = 0;
    if (distanceToPolice !== null) {
      if (distanceToPolice < 1000) {
        policeScore = 10;
      } else if (distanceToPolice < 3000) {
        policeScore = 7;
      } else if (distanceToPolice < 5000) {
        policeScore = 5;
      } else {
        policeScore = Math.max(0, 5 - (distanceToPolice - 5000) / 1000);
      }
    }
    score += policeScore;
    breakdown.police_distance_score = Math.round(policeScore * 10) / 10;

    // Hospital Distance Score (0-10 points)
    let hospitalScore = 0;
    if (distanceToHospital !== null) {
      if (distanceToHospital < 2000) {
        hospitalScore = 10;
      } else if (distanceToHospital < 5000) {
        hospitalScore = 7;
      } else if (distanceToHospital < 10000) {
        hospitalScore = 5;
      } else {
        hospitalScore = Math.max(0, 5 - (distanceToHospital - 10000) / 2000);
      }
    }
    score += hospitalScore;
    breakdown.hospital_distance_score = Math.round(hospitalScore * 10) / 10;

    // Road Distance Score (0-10 points)
    let roadScore = 0;
    if (distanceToRoad !== null) {
      if (distanceToRoad < 500) {
        roadScore = 10;
      } else if (distanceToRoad < 1000) {
        roadScore = 8;
      } else if (distanceToRoad < 2000) {
        roadScore = 6;
      } else {
        roadScore = Math.max(0, 6 - (distanceToRoad - 2000) / 1000);
      }
    }
    score += roadScore;
    breakdown.road_distance_score = Math.round(roadScore * 10) / 10;

    // FTL Zone Penalty (0-10 points deduction)
    // Higher FTL percentage = lower score
    const ftlPenalty = (ftlZonePercentage / 100) * 10;
    score -= ftlPenalty;
    breakdown.ftl_penalty = Math.round(ftlPenalty * 10) / 10;

    // Ensure score is between 0 and 100
    score = Math.max(0, Math.min(100, score));

    return {
      score: Math.round(score * 10) / 10,
      breakdown
    };
  }
}

export const gisService = new GISService();
