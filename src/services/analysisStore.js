/**
 * Analysis Results Store
 * 
 * Since ts_warangal_survey only stores basic info (surveyno, village, geom),
 * we need to store analysis results (POIs, distances, scores) separately.
 * 
 * This is an in-memory store. For production, consider:
 * - Redis
 * - Separate database table (if allowed)
 * - File-based storage
 */

const analysisStore = new Map();

export class AnalysisStore {
  /**
   * Store analysis results for a survey
   * @param {string} surveyId - Survey ID (gid from ts_warangal_survey)
   * @param {Object} analysisData - Analysis results
   */
  static set(surveyId, analysisData) {
    analysisStore.set(surveyId.toString(), {
      ...analysisData,
      stored_at: new Date().toISOString()
    });
  }

  /**
   * Get analysis results for a survey
   * @param {string} surveyId - Survey ID
   * @returns {Object|null} Analysis data or null
   */
  static get(surveyId) {
    return analysisStore.get(surveyId.toString()) || null;
  }

  /**
   * Check if analysis exists for a survey
   * @param {string} surveyId - Survey ID
   * @returns {boolean}
   */
  static has(surveyId) {
    return analysisStore.has(surveyId.toString());
  }

  /**
   * Delete analysis results
   * @param {string} surveyId - Survey ID
   */
  static delete(surveyId) {
    analysisStore.delete(surveyId.toString());
  }

  /**
   * Get all stored analysis IDs
   * @returns {Array<string>}
   */
  static getAllIds() {
    return Array.from(analysisStore.keys());
  }
}



