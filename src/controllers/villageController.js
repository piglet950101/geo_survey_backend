import pool from '../config/database.js';
import { asyncHandler } from '../middleware/errorHandler.js';

/**
 * Get All Villages Data
 */
export const getAllData = asyncHandler(async (req, res) => {
    try {
      // Get village data from ts_warangal_survey_centroids table (matching original)
      let villageData = {};
      let allVillages = [];

      const surveyResult = await pool.query(
        'SELECT DISTINCT village, surveyno FROM ts_warangal_survey_centroids WHERE village IS NOT NULL AND surveyno IS NOT NULL ORDER BY village, surveyno'
      );
      
      surveyResult.rows.forEach(row => {
        if (!villageData[row.village]) {
          villageData[row.village] = [];
          allVillages.push(row.village);
        }
        if (!villageData[row.village].includes(row.surveyno)) {
          villageData[row.village].push(row.surveyno);
        }
      });

    res.json({
      data: {
        success: true,
        villageData,
        allVillages: allVillages.sort()
      }
    });
  } catch (error) {
    console.error('Error getting villages data:', error);
    res.status(500).json({
      data: { error: 'Failed to load villages data' }
    });
  }
});

/**
 * Get Village Suggestions (Autocomplete)
 */
export const getSuggestions = asyncHandler(async (req, res) => {
  const { query } = req.query;

  if (!query || query.length < 2) {
    return res.json({
      data: {
        success: true,
        suggestions: []
      }
    });
  }

  try {
    const result = await pool.query(
      `SELECT DISTINCT village 
       FROM ts_warangal_survey_centroids 
       WHERE village IS NOT NULL AND LOWER(village) LIKE LOWER($1) 
       ORDER BY village 
       LIMIT 20`,
      [`%${query}%`]
    );

    const suggestions = result.rows.map(row => row.village);

    res.json({
      data: {
        success: true,
        suggestions
      }
    });
  } catch (error) {
    console.error('Error getting village suggestions:', error);
    res.status(500).json({
      data: { error: 'Failed to get suggestions' }
    });
  }
});

/**
 * Get Survey Numbers for a Village
 */
export const getSurveyNumbers = asyncHandler(async (req, res) => {
  const { village } = req.query;

  if (!village) {
    return res.status(400).json({
      data: { error: 'Village name is required' }
    });
  }

  try {
    const result = await pool.query(
      `SELECT DISTINCT surveyno as survey_number
       FROM ts_warangal_survey_centroids 
       WHERE village = $1 AND surveyno IS NOT NULL
       ORDER BY surveyno`,
      [village]
    );

    const surveyNumbers = result.rows.map(row => row.survey_number);

    res.json({
      data: {
        success: true,
        surveyNumbers
      }
    });
  } catch (error) {
    console.error('Error getting survey numbers:', error);
    res.status(500).json({
      data: { error: 'Failed to get survey numbers' }
    });
  }
});

/**
 * Search Villages
 */
export const searchVillages = asyncHandler(async (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({
      data: { error: 'Search query is required' }
    });
  }

  try {
    const result = await pool.query(
      `SELECT DISTINCT village 
       FROM ts_warangal_survey_centroids 
       WHERE village IS NOT NULL AND LOWER(village) LIKE LOWER($1) 
       ORDER BY village 
       LIMIT 20`,
      [`${query}%`]
    );

    const villages = result.rows.map(row => row.village);

    res.json({
      data: {
        success: true,
        villages
      }
    });
  } catch (error) {
    console.error('Error searching villages:', error);
    res.status(500).json({
      data: { error: 'Search failed' }
    });
  }
});

/**
 * Search Survey Numbers
 */
export const searchSurveyNumbers = asyncHandler(async (req, res) => {
  const { query, village } = req.query;

  if (!query) {
    return res.status(400).json({
      data: { error: 'Search query is required' }
    });
  }

  try {
    let sql = `SELECT DISTINCT surveyno as survey_number FROM ts_warangal_survey_centroids WHERE surveyno IS NOT NULL`;
    const params = [];

    if (village) {
      sql += ` AND village = $${params.length + 1}`;
      params.push(village);
    }

    if (query && query.length > 0) {
      sql += ` AND LOWER(surveyno) LIKE LOWER($${params.length + 1})`;
      params.push(`${query}%`);
    }

    sql += ` ORDER BY surveyno LIMIT 20`;

    const result = await pool.query(sql, params);
    const surveyNumbers = result.rows.map(row => row.survey_number);

    res.json({
      data: {
        success: true,
        surveyNumbers
      }
    });
  } catch (error) {
    console.error('Error searching survey numbers:', error);
    res.status(500).json({
      data: { error: 'Search failed' }
    });
  }
});

