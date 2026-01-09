import { asyncHandler } from '../middleware/errorHandler.js';
import { jsPDF } from 'jspdf';
import { SurveyResult } from '../models/SurveyResult.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Export Report PDF
 * Generates a PDF report for the survey analysis
 * Layout matches the UI design with:
 * 1. Logo (top-left)
 * 2. Title "Land Survey & Infrastructure Analysis" with Division and Survey number
 * 3. Nearby Points of Interest (left column - with donut chart)
 * 4. FTL Zone Analysis (left column)
 * 5. Survey Location Map (left column)
 * 6. Development Score (right column - green header)
 * 7. Distance to Key Amenities (right column)
 * 8. Location Insights (right column)
 * 9. Analysis Details (right column)
 */
export const exportReportPDF = asyncHandler(async (req, res) => {
  const { surveyResultId, resultData, chartImages } = req.body;

  if (!surveyResultId) {
    return res.status(400).json({
      data: { error: 'Survey result ID is required' }
    });
  }

  // Use passed resultData if available (to avoid in-memory storage issues on deployed servers)
  // Otherwise fall back to fetching from database/store
  let result;
  if (resultData && resultData.poi_breakdown) {
    console.log('📄 PDF Export: Using resultData passed from frontend');
    result = resultData;
  } else {
    console.log('📄 PDF Export: Fetching result from database for ID:', surveyResultId);
    result = await SurveyResult.findById(surveyResultId);
  }

  if (!result) {
    return res.status(404).json({
      data: { error: 'Survey result not found' }
    });
  }

  // Log chart images availability
  console.log('📄 PDF Export - Chart images:', {
    poiChart: chartImages?.poiChart ? 'provided' : 'missing',
    ftlChart: chartImages?.ftlChart ? 'provided' : 'missing',
    map: chartImages?.map ? 'provided' : 'missing',
    score: chartImages?.score ? 'provided' : 'missing',
    distance: chartImages?.distance ? 'provided' : 'missing'
  });

  // Create PDF - A4 size
  const doc = new jsPDF('p', 'mm', 'a4');
  const margin = 8;
  const leftColWidth = 125;
  const rightColWidth = 62;
  const rightColX = margin + leftColWidth + 5;


  // ==================== HEADER SECTION ====================

  // 1. Logo (top-left) - use local logo.jpg file (no border)
  // Try multiple paths to find the logo (logo.jpg should be in backend folder)
  const possiblePaths = [
    path.resolve(process.cwd(), 'logo.jpg'),           // Backend root folder (deployed)
    path.resolve(__dirname, '../../logo.jpg'),         // From controllers -> src -> backend
    path.resolve(__dirname, '../../../logo.jpg'),      // One more level up
    path.resolve(process.cwd(), '../logo.jpg'),        // Project root
  ];

  let logoLoaded = false;
  for (const logoPath of possiblePaths) {
    try {
      if (fs.existsSync(logoPath)) {
        console.log('📷 Loading logo from:', logoPath);
        const logoBuffer = fs.readFileSync(logoPath);
        const logoBase64 = logoBuffer.toString('base64');
        doc.addImage(`data:image/jpeg;base64,${logoBase64}`, 'JPEG', margin, margin, 45, 12);
        logoLoaded = true;
        console.log('✅ Logo loaded successfully');
        break;
      }
    } catch (error) {
      console.error('Failed to load logo from', logoPath, ':', error.message);
    }
  }

  if (!logoLoaded) {
    console.error('❌ Could not load logo from any path. Tried:', possiblePaths);
    // Fallback: Draw text logo
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 138);
    doc.text('GISACCESS', margin, margin + 8);
  }

  // 2. Title - "Land Survey & Infrastructure Analysis"
  doc.setTextColor(220, 38, 38); // Red color like in image
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Land Survey & Infrastructure Analysis', 58, margin + 6);

  // Division and Survey Number on same line
  doc.setFontSize(14);
  doc.setTextColor(59, 130, 246); // Blue color
  doc.text(`Division : ${result.village}`, 58, margin + 13);
  doc.text(`Survey number : ${result.survey_number}`, 138, margin + 13);

  // Main content starts below header
  let contentY = margin + 20;

  // ==================== LEFT COLUMN ====================

  // 3. Nearby Points of Interest - USE CAPTURED IMAGE FROM FRONTEND
  const poiCardHeight = 95;

  if (chartImages?.poiChart) {
    // Use the exact image captured from frontend
    try {
      const format = chartImages.poiChart.includes('image/jpeg') ? 'JPEG' : 'PNG';
      doc.addImage(chartImages.poiChart, format, margin, contentY, leftColWidth, poiCardHeight);
      console.log('✅ POI chart image added to PDF');
    } catch (error) {
      console.error('❌ Failed to add POI chart image:', error);
      drawCard(doc, margin, contentY, leftColWidth, poiCardHeight, 'Nearby Points of Interest', [220, 38, 38]);
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.text('Chart image unavailable', margin + leftColWidth / 2, contentY + 50, { align: 'center' });
    }
  } else {
    // Fallback: draw placeholder card
    drawCard(doc, margin, contentY, leftColWidth, poiCardHeight, 'Nearby Points of Interest', [220, 38, 38]);
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text('Chart image not provided', margin + leftColWidth / 2, contentY + 50, { align: 'center' });
  }

  // 4. FTL Zone Analysis - USE CAPTURED IMAGE FROM FRONTEND
  const ftlY = contentY + poiCardHeight + 3;
  const ftlCardHeight = 50;

  if (chartImages?.ftlChart) {
    try {
      const format = chartImages.ftlChart.includes('image/jpeg') ? 'JPEG' : 'PNG';
      doc.addImage(chartImages.ftlChart, format, margin, ftlY, leftColWidth, ftlCardHeight);
      console.log('✅ FTL chart image added to PDF');
    } catch (error) {
      console.error('❌ Failed to add FTL chart image:', error);
      drawCard(doc, margin, ftlY, leftColWidth, ftlCardHeight, 'FTL Zone Analysis', [220, 38, 38]);
    }
  } else {
    drawCard(doc, margin, ftlY, leftColWidth, ftlCardHeight, 'FTL Zone Analysis', [220, 38, 38]);
  }

  // 5. Survey Location Map - USE CAPTURED IMAGE FROM FRONTEND
  const mapY = ftlY + ftlCardHeight + 3;
  const mapCardHeight = 100;

  if (chartImages?.map) {
    try {
      const format = chartImages.map.includes('image/jpeg') ? 'JPEG' : 'PNG';
      doc.addImage(chartImages.map, format, margin, mapY, leftColWidth, mapCardHeight);
      console.log('✅ Map image added to PDF');
    } catch (error) {
      console.error('❌ Failed to add map image:', error);
      drawCard(doc, margin, mapY, leftColWidth, mapCardHeight, 'Survey Location Map', [59, 130, 246]);
    }
  } else {
    drawCard(doc, margin, mapY, leftColWidth, mapCardHeight, 'Survey Location Map', [59, 130, 246]);
  }

  // ==================== RIGHT COLUMN ====================

  // 6. Development Score - USE CAPTURED IMAGE FROM FRONTEND
  const scoreCardHeight = 95;

  if (chartImages?.score) {
    try {
      const format = chartImages.score.includes('image/jpeg') ? 'JPEG' : 'PNG';
      doc.addImage(chartImages.score, format, rightColX, contentY, rightColWidth, scoreCardHeight);
      console.log('✅ Score image added to PDF');
    } catch (error) {
      console.error('❌ Failed to add score image:', error);
      drawCard(doc, rightColX, contentY, rightColWidth, scoreCardHeight, 'Development Score', [34, 197, 94]);
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.text('Score image unavailable', rightColX + rightColWidth / 2, contentY + 50, { align: 'center' });
    }
  } else {
    drawCard(doc, rightColX, contentY, rightColWidth, scoreCardHeight, 'Development Score', [34, 197, 94]);
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text('Score image not provided', rightColX + rightColWidth / 2, contentY + 50, { align: 'center' });
  }

  // 7. Distance to Key Amenities - USE CAPTURED IMAGE FROM FRONTEND
  const distanceY = contentY + scoreCardHeight + 3;
  const distanceCardHeight = 62;

  if (chartImages?.distance) {
    try {
      const format = chartImages.distance.includes('image/jpeg') ? 'JPEG' : 'PNG';
      doc.addImage(chartImages.distance, format, rightColX, distanceY, rightColWidth, distanceCardHeight);
      console.log('✅ Distance image added to PDF');
    } catch (error) {
      console.error('❌ Failed to add distance image:', error);
      drawCard(doc, rightColX, distanceY, rightColWidth, distanceCardHeight, 'Distance to Key Amenities', [59, 130, 246]);
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.text('Distance image unavailable', rightColX + rightColWidth / 2, distanceY + 35, { align: 'center' });
    }
  } else {
    drawCard(doc, rightColX, distanceY, rightColWidth, distanceCardHeight, 'Distance to Key Amenities', [59, 130, 246]);
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text('Distance image not provided', rightColX + rightColWidth / 2, distanceY + 35, { align: 'center' });
  }

  // 8. Location Insights Card
  const insightsY = distanceY + distanceCardHeight + 3;
  const insightsCardHeight = 45;
  const devScore = result.development_score || 0;

  drawCard(doc, rightColX, insightsY, rightColWidth, insightsCardHeight, 'Location Insights', [168, 85, 247]);

  // Subtitle
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text('Key observations and recommendations', rightColX + 4, insightsY + 13);

  // Checkmark icon (green circle)
  doc.setFillColor(34, 197, 94);
  doc.circle(rightColX + 6, insightsY + 20, 2, 'F');

  // Insight title
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 197, 94);
  const insightTitle = devScore >= 80 ? 'Highly Recommended' : devScore >= 60 ? 'Recommended' : devScore >= 40 ? 'Moderate' : 'Needs Review';
  doc.text(insightTitle, rightColX + 11, insightsY + 21);

  // Insight text
  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(55, 65, 81);
  const insightText = devScore >= 80
    ? 'Excellent location with strong infrastructure, good connectivity, and minimal restrictions. Ideal for residential or commercial development.'
    : devScore >= 60
    ? 'Good location with decent infrastructure and connectivity. Suitable for development with minor considerations.'
    : devScore >= 40
    ? 'Average location with some limitations. Development possible with careful planning.'
    : 'Location has significant limitations. Consider alternative locations or extensive planning.';
  const insightLines = doc.splitTextToSize(insightText, rightColWidth - 8);
  doc.text(insightLines, rightColX + 4, insightsY + 27);

  // 9. Analysis Details Card
  const detailsY = insightsY + insightsCardHeight + 3;
  const detailsCardHeight = 35;

  drawCard(doc, rightColX, detailsY, rightColWidth, detailsCardHeight, 'Analysis Details', [107, 114, 128]);

  // Coordinates
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text('Coordinates', rightColX + 4, detailsY + 14);
  doc.setTextColor(31, 41, 55);
  const latStr = result.latitude ? result.latitude.toFixed(6) : 'N/A';
  const lonStr = result.longitude ? result.longitude.toFixed(6) : 'N/A';
  doc.text(`${latStr}, ${lonStr}`, rightColX + 4, detailsY + 19);

  // Analysis Date
  doc.setTextColor(107, 114, 128);
  doc.text('Analysis Date', rightColX + 4, detailsY + 26);
  doc.setTextColor(31, 41, 55);
  const analysisDate = result.analysis_date ? new Date(result.analysis_date) : new Date();
  doc.text(analysisDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }), rightColX + 4, detailsY + 31);

  // Generate PDF as buffer
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

  // Return PDF
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${result.village}_${result.survey_number}.pdf`);
  res.send(pdfBuffer);
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Draw a card with colored header border
 */
function drawCard(doc, x, y, width, height, title, headerColor) {
  // Card background
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(x, y, width, height, 2, 2, 'FD');

  // Colored top border
  doc.setDrawColor(headerColor[0], headerColor[1], headerColor[2]);
  doc.setLineWidth(1.5);
  doc.line(x + 2, y, x + width - 2, y);

  // Title
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(headerColor[0], headerColor[1], headerColor[2]);
  doc.text(title, x + 4, y + 8);

  // Reset line width
  doc.setLineWidth(0.2);
}


