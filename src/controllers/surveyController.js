import { SurveyResult } from '../models/SurveyResult.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { gisService } from '../services/gisService.js';

/**
 * Analyze Survey Location
 */
export const analyzeSurvey = asyncHandler(async (req, res) => {
  const { village, surveyNumber } = req.body;
  const userId = req.user.id;

  if (!village || !surveyNumber) {
    return res.status(400).json({
      data: { error: 'Village and survey number are required' }
    });
  }

  try {
    // Call GIS service to analyze the survey location
    const analysisResult = await gisService.analyzeLocation(village, surveyNumber);

    if (!analysisResult || analysisResult.error) {
      return res.status(500).json({
        data: { error: analysisResult?.error || 'Analysis failed' }
      });
    }

    // Save result to database (ts_warangal_survey doesn't have user_id column)
    const savedResult = await SurveyResult.create({
      village,
      survey_number: surveyNumber,
      ...analysisResult
    });

    res.json({
      data: {
        success: true,
        data: savedResult
      }
    });
  } catch (error) {
    console.error('Survey analysis error:', error);
    res.status(500).json({
      data: { error: error.message || 'Analysis failed. Please try again.' }
    });
  }
});

