import { asyncHandler } from '../middleware/errorHandler.js';
import { jsPDF } from 'jspdf';
import { SurveyResult } from '../models/SurveyResult.js';

/**
 * Export Report PDF
 * Generates a PDF report for the survey analysis
 */
export const exportReportPDF = asyncHandler(async (req, res) => {
  const { surveyResultId } = req.body;
  const userId = req.user?.id;

  if (!surveyResultId) {
    return res.status(400).json({
      data: { error: 'Survey result ID is required' }
    });
  }

  // Get survey result
  const result = await SurveyResult.findById(surveyResultId);

  if (!result) {
    return res.status(404).json({
      data: { error: 'Survey result not found' }
    });
  }

  // Create PDF
  const doc = new jsPDF('p', 'mm', 'a4');

  // Title
  doc.setTextColor(31, 41, 55); // Gray-800
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('Land Survey & Infrastructure Analysis', 105, 18, { align: 'center' });

  // Division and Survey Number
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(`Division : ${result.village}`, 15, 32);
  doc.text(`Survey number : ${result.survey_number}`, 140, 32);

  // Generate PDF as buffer
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

  // Return PDF
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${result.village}_${result.survey_number}.pdf`);
  res.send(pdfBuffer);
});

