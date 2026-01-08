import pool from '../config/database.js';
import { asyncHandler } from '../middleware/errorHandler.js';

/**
 * Debug Survey Data
 * Matches original Base44 debugSurveyData function
 */
export const debugSurveyData = asyncHandler(async (req, res) => {
  const { village, surveyNumber } = req.body;

  if (!village || !surveyNumber) {
    return res.status(400).json({
      data: { error: 'Village and survey number are required' }
    });
  }

  try {
    // Check exact match
    const exactMatch = await pool.query(
      `SELECT village, surveyno
       FROM ts_warangal_survey_centroids
       WHERE village = $1 AND surveyno = $2
       LIMIT 1`,
      [village, surveyNumber]
    );

    // Check case-insensitive match
    const caseInsensitiveMatch = await pool.query(
      `SELECT village, surveyno
       FROM ts_warangal_survey_centroids
       WHERE LOWER(village) = LOWER($1) AND surveyno = $2
       LIMIT 5`,
      [village, surveyNumber]
    );

    // Check similar villages
    const similarVillages = await pool.query(
      `SELECT DISTINCT village
       FROM ts_warangal_survey_centroids
       WHERE LOWER(village) LIKE LOWER($1)
       LIMIT 10`,
      [`%${village}%`]
    );

    // Check survey numbers for this village (case-insensitive)
    const surveysInVillage = await pool.query(
      `SELECT surveyno
       FROM ts_warangal_survey_centroids
       WHERE LOWER(village) = LOWER($1)
       ORDER BY surveyno
       LIMIT 20`,
      [village]
    );

    res.json({
      data: {
        input: { village, surveyNumber },
        exactMatch: exactMatch.rows.length > 0 ? exactMatch.rows[0] : null,
        caseInsensitiveMatches: caseInsensitiveMatch.rows,
        similarVillages: similarVillages.rows.map(v => v.village),
        surveysInVillage: surveysInVillage.rows.map(s => s.surveyno)
      }
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({
      data: {
        error: error.message,
        details: error.stack
      }
    });
  }
});

