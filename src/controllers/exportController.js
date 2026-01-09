import { asyncHandler } from '../middleware/errorHandler.js';
import { jsPDF } from 'jspdf';
import { SurveyResult } from '../models/SurveyResult.js';

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

  // Create PDF - A4 size
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 8;
  const leftColWidth = 125;
  const rightColWidth = 62;
  const rightColX = margin + leftColWidth + 5;

  // Color palette for POI categories
  const COLORS = [
    [139, 92, 246],   // purple
    [59, 130, 246],   // blue
    [236, 72, 153],   // pink
    [249, 115, 22],   // orange
    [234, 179, 8],    // yellow
    [132, 204, 22],   // lime
    [34, 197, 94],    // green
    [20, 184, 166],   // teal
    [6, 182, 212],    // cyan
    [99, 102, 241],   // indigo
    [168, 85, 247],   // violet
    [217, 70, 239],   // fuchsia
    [244, 63, 94],    // rose
    [239, 68, 68],    // red
    [251, 146, 60],   // amber
    [163, 230, 53],   // light green
    [45, 212, 191],   // emerald
    [56, 189, 248],   // sky
  ];

  // ==================== HEADER SECTION ====================

  // 1. Logo (top-left) - with red border like in image
  const logoUrl = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e4844ed620b4351643b737/8903325f1_GISACCESS_LOGO1.png';
  try {
    const logoResponse = await fetch(logoUrl);
    if (logoResponse.ok) {
      const logoBuffer = await logoResponse.arrayBuffer();
      const logoBase64 = Buffer.from(logoBuffer).toString('base64');
      // Draw logo border (red)
      doc.setDrawColor(220, 38, 38);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, margin, 38, 14, 1, 1, 'S');
      doc.addImage(`data:image/png;base64,${logoBase64}`, 'PNG', margin + 2, margin + 2, 34, 10);
    }
  } catch (error) {
    console.error('Failed to load logo:', error);
    // Fallback: Draw text logo
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, margin, 38, 14, 1, 1, 'S');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text('GISACCESS', margin + 5, margin + 9);
  }

  // 2. Title - "Land Survey & Infrastructure Analysis"
  doc.setTextColor(220, 38, 38); // Red color like in image
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Land Survey & Infrastructure Analysis', 50, margin + 6);

  // Division and Survey Number on same line
  doc.setFontSize(14);
  doc.setTextColor(59, 130, 246); // Blue color
  doc.text(`Division : ${result.village}`, 50, margin + 13);
  doc.text(`Survey number : ${result.survey_number}`, 130, margin + 13);

  // Main content starts below header
  let contentY = margin + 20;

  // ==================== LEFT COLUMN ====================

  // 3. Nearby Points of Interest Card
  const poiCardHeight = 95;
  drawCard(doc, margin, contentY, leftColWidth, poiCardHeight, 'Nearby Points of Interest', [220, 38, 38]);

  // Draw Donut Chart using circles (simpler approach)
  const chartCenterX = margin + 35;
  const chartCenterY = contentY + 50;
  const outerRadius = 28;
  const innerRadius = 16;

  const poiBreakdown = (result.poi_breakdown || []).slice(0, 18);
  const totalPois = poiBreakdown.reduce((sum, p) => sum + p.count, 0) || 1;

  // Draw donut segments using pie slices
  let startAngle = -90; // Start from top
  poiBreakdown.forEach((poi, index) => {
    const color = COLORS[index % COLORS.length];
    const sweepAngle = (poi.count / totalPois) * 360;
    if (sweepAngle > 0) {
      drawPieSlice(doc, chartCenterX, chartCenterY, outerRadius, startAngle, sweepAngle, color);
    }
    startAngle += sweepAngle;
  });

  // Draw center circle (white) to create donut effect
  doc.setFillColor(255, 255, 255);
  doc.circle(chartCenterX, chartCenterY, innerRadius, 'F');

  // POI Legend - Two columns on right side of donut
  doc.setFontSize(6);
  const legendStartX = margin + 68;
  const legendStartY = contentY + 15;
  const midPoint = Math.ceil(poiBreakdown.length / 2);

  // Left legend column
  poiBreakdown.slice(0, midPoint).forEach((poi, index) => {
    const y = legendStartY + (index * 8);
    const color = COLORS[index % COLORS.length];

    // Color dot
    doc.setFillColor(color[0], color[1], color[2]);
    doc.circle(legendStartX, y, 1.5, 'F');

    // Count and percentage
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(String(poi.count), legendStartX + 4, y + 1);

    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', 'normal');
    doc.text(`(${poi.percent}%)`, legendStartX + 12, y + 1);

    // Category name
    doc.setTextColor(55, 65, 81);
    const catName = formatCategoryName(poi.category);
    doc.text(catName.substring(0, 18), legendStartX + 24, y + 1);
  });

  // Right legend column
  poiBreakdown.slice(midPoint).forEach((poi, index) => {
    const y = legendStartY + (index * 8);
    const colorIndex = midPoint + index;
    const color = COLORS[colorIndex % COLORS.length];
    const colX = legendStartX + 58;

    // Color dot
    doc.setFillColor(color[0], color[1], color[2]);
    doc.circle(colX, y, 1.5, 'F');

    // Count and percentage
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(String(poi.count), colX + 4, y + 1);

    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', 'normal');
    doc.text(`(${poi.percent}%)`, colX + 12, y + 1);

    // Category name
    doc.setTextColor(55, 65, 81);
    const catName = formatCategoryName(poi.category);
    doc.text(catName.substring(0, 18), colX + 24, y + 1);
  });

  // 4. FTL Zone Analysis Card
  const ftlY = contentY + poiCardHeight + 3;
  const ftlCardHeight = 38;
  const rawFtlPercentage = result.ftl_zone_percentage || 0;
  const ftlPercentage = rawFtlPercentage > 9 ? Math.round(rawFtlPercentage) : 0;

  drawCard(doc, margin, ftlY, leftColWidth, ftlCardHeight, 'FTL Zone Analysis', [220, 38, 38]);

  // Subtitle
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text('Full Tank Level Risk Assessment', margin + 4, ftlY + 14);

  // FTL Percentage display - large text
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(31, 41, 55);
  doc.text('Chance of falling in FTL zone', margin + 4, ftlY + 22);

  // Large percentage on right
  doc.setFontSize(24);
  if (ftlPercentage === 0) {
    doc.setTextColor(34, 197, 94);
  } else {
    doc.setTextColor(239, 68, 68);
  }
  doc.text(`${ftlPercentage}%`, margin + leftColWidth - 20, ftlY + 25, { align: 'right' });

  // Risk status
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  if (ftlPercentage === 0) {
    doc.setTextColor(34, 197, 94);
    doc.text('No Risk', margin + 4, ftlY + 30);
  } else {
    doc.setTextColor(239, 68, 68);
    doc.text('At Risk', margin + 4, ftlY + 30);
  }

  // Description
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  const ftlDesc = ftlPercentage === 0
    ? 'This survey location does not fall within any FTL (Full Tank Level) zones. No water body restrictions apply.'
    : 'This survey location falls within an FTL zone. Construction restrictions may apply.';
  const ftlLines = doc.splitTextToSize(ftlDesc, leftColWidth - 8);
  doc.text(ftlLines, margin + 4, ftlY + 35);

  // 5. Survey Location Map Card
  const mapY = ftlY + ftlCardHeight + 3;
  const mapCardHeight = 115;

  drawCard(doc, margin, mapY, leftColWidth, mapCardHeight, 'Survey Location Map', [59, 130, 246]);

  // Map subtitle
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text('10-minute walking radius with POIs and amenities', margin + 4, mapY + 14);

  // Generate and embed Mapbox Static Image
  if (result.latitude && result.longitude) {
    const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;
    const lat = result.latitude;
    const lon = result.longitude;

    if (MAPBOX_TOKEN) {
      let overlays = [];
      overlays.push(`pin-l+ef4444(${lon},${lat})`);

      if (result.map_data?.nearest_police) {
        overlays.push(`pin-s-police+3b82f6(${result.map_data.nearest_police.lon},${result.map_data.nearest_police.lat})`);
      }
      if (result.map_data?.nearest_hospital) {
        overlays.push(`pin-s-hospital+ef4444(${result.map_data.nearest_hospital.lon},${result.map_data.nearest_hospital.lat})`);
      }
      if (result.map_data?.nearest_road) {
        overlays.push(`pin-s-car+22c55e(${result.map_data.nearest_road.lon},${result.map_data.nearest_road.lat})`);
      }

      const overlayString = overlays.join(',');
      const mapUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${overlayString}/${lon},${lat},13,0/600x400?access_token=${MAPBOX_TOKEN}`;

      try {
        console.log('🗺️  Fetching Mapbox static image for PDF...');
        const mapResponse = await fetch(mapUrl);
        const contentType = mapResponse.headers.get('content-type');

        if (mapResponse.ok && contentType && contentType.startsWith('image/')) {
          const mapImageBuffer = await mapResponse.arrayBuffer();
          const mapImageBase64 = Buffer.from(mapImageBuffer).toString('base64');
          doc.addImage(`data:image/png;base64,${mapImageBase64}`, 'PNG', margin + 2, mapY + 18, leftColWidth - 4, 80);
          console.log('✅ Map image added to PDF');
        } else {
          throw new Error(`Invalid response: ${contentType || mapResponse.status}`);
        }
      } catch (error) {
        console.error('❌ Failed to fetch map image:', error.message);
        drawMapPlaceholder(doc, margin + 2, mapY + 18, leftColWidth - 4, 80);
      }
    } else {
      drawMapPlaceholder(doc, margin + 2, mapY + 18, leftColWidth - 4, 80);
    }
  } else {
    drawMapPlaceholder(doc, margin + 2, mapY + 18, leftColWidth - 4, 80);
  }

  // Map Legend
  const mapLegendY = mapY + 100;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(55, 65, 81);
  doc.text('Map Legend:', margin + 4, mapLegendY);

  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');

  // Legend items in a row
  let legendX = margin + 25;
  // Survey Location
  doc.setFillColor(239, 68, 68);
  doc.circle(legendX, mapLegendY - 1, 2, 'F');
  doc.setTextColor(55, 65, 81);
  doc.text('Survey Location', legendX + 4, mapLegendY);

  // 10-min Walk Area
  legendX += 30;
  doc.setDrawColor(147, 51, 234);
  doc.setLineWidth(0.5);
  doc.line(legendX - 3, mapLegendY - 1, legendX + 3, mapLegendY - 1);
  doc.text('10-min Walk Area', legendX + 5, mapLegendY);

  // Police Station
  legendX += 30;
  doc.setFillColor(59, 130, 246);
  doc.circle(legendX, mapLegendY - 1, 2, 'F');
  doc.text('Police Station', legendX + 4, mapLegendY);

  // Hospital
  legendX += 25;
  doc.setFillColor(239, 68, 68);
  doc.circle(legendX, mapLegendY - 1, 2, 'F');
  doc.text('Hospital', legendX + 4, mapLegendY);

  // Second legend row
  const mapLegendY2 = mapLegendY + 6;
  legendX = margin + 25;
  doc.setFillColor(34, 197, 94);
  doc.circle(legendX, mapLegendY2 - 1, 2, 'F');
  doc.text('Main Road', legendX + 4, mapLegendY2);

  legendX += 25;
  doc.setFillColor(168, 85, 247);
  doc.circle(legendX, mapLegendY2 - 1, 2, 'F');
  doc.text('POIs (colored by category)', legendX + 4, mapLegendY2);

  legendX += 40;
  doc.setFillColor(37, 99, 235);
  doc.rect(legendX - 2, mapLegendY2 - 3, 6, 4, 'F');
  doc.text('FTL Zone (Tank Area)', legendX + 6, mapLegendY2);

  // ==================== RIGHT COLUMN ====================

  // 6. Development Score Card (with green header)
  const devScore = result.development_score || 0;
  const scoreCardHeight = 85;

  // Card background
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(rightColX, contentY, rightColWidth, scoreCardHeight, 2, 2, 'FD');

  // Green header
  doc.setFillColor(34, 197, 94); // Green
  doc.roundedRect(rightColX, contentY, rightColWidth, 12, 2, 2, 'F');
  // Cover bottom corners of header
  doc.rect(rightColX, contentY + 8, rightColWidth, 4, 'F');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Development Score', rightColX + 4, contentY + 8);

  // Subtitle
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  doc.text('Overall location quality assessment', rightColX + 4, contentY + 11);

  // Score circle
  const scoreCenterX = rightColX + rightColWidth / 2;
  const scoreCenterY = contentY + 30;
  const scoreRadius = 14;

  // Background circle
  doc.setFillColor(220, 252, 231); // Light green
  doc.circle(scoreCenterX, scoreCenterY, scoreRadius, 'F');

  // Score text
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 163, 74); // Green
  doc.text(String(devScore), scoreCenterX, scoreCenterY + 2, { align: 'center' });

  // "out of 100"
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text('out of 100', scoreCenterX, scoreCenterY + 8, { align: 'center' });

  // Score level
  const scoreLevel = devScore >= 80 ? 'Excellent' : devScore >= 60 ? 'Good' : devScore >= 40 ? 'Average' : 'Needs Improvement';
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 163, 74);
  doc.text(scoreLevel, scoreCenterX, scoreCenterY + 14, { align: 'center' });

  // Score Breakdown section
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(31, 41, 55);
  doc.text('Score Breakdown:', rightColX + 4, contentY + 52);

  const breakdown = result.score_breakdown || {};
  const breakdownItems = [
    { label: 'POI Count & Diversity', score: breakdown.poi_score || 0, max: 30 },
    { label: 'Proximity to Amenities', score: breakdown.amenity_score || 0, max: 25 },
    { label: 'FTL Zone Safety', score: breakdown.ftl_score || 0, max: 20 },
    { label: 'Supportive Businesses', score: breakdown.business_score || 0, max: 15 },
    { label: 'Overall Accessibility', score: breakdown.accessibility_score || 0, max: 10 }
  ];

  let breakdownY = contentY + 58;
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');

  breakdownItems.forEach(item => {
    doc.setTextColor(55, 65, 81);
    doc.text(item.label, rightColX + 4, breakdownY);
    doc.setTextColor(34, 197, 94);
    const scoreText = typeof item.score === 'number' ? item.score.toFixed(1) : '0.0';
    doc.text(`${scoreText}/${item.max}`, rightColX + rightColWidth - 4, breakdownY, { align: 'right' });
    breakdownY += 5;
  });

  // 7. Distance to Key Amenities Card
  const distanceY = contentY + scoreCardHeight + 3;
  const distanceCardHeight = 62;

  drawCard(doc, rightColX, distanceY, rightColWidth, distanceCardHeight, 'Distance to Key Amenities', [59, 130, 246]);

  // Subtitle
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text('Nearest facilities from survey location', rightColX + 4, distanceY + 13);

  // Police Station row
  const policeDist = result.distance_to_police || 0;
  drawDistanceRow(doc, rightColX + 3, distanceY + 18, rightColWidth - 6, 'Police Station', policeDist, [219, 234, 254], [59, 130, 246]);

  // Hospital row
  const hospitalDist = result.distance_to_hospital || 0;
  drawDistanceRow(doc, rightColX + 3, distanceY + 32, rightColWidth - 6, 'Hospital', hospitalDist, [254, 226, 226], [239, 68, 68]);

  // Main Road row
  const roadDist = result.distance_to_main_road || 0;
  drawDistanceRow(doc, rightColX + 3, distanceY + 46, rightColWidth - 6, 'Main Road', roadDist, [220, 252, 231], [34, 197, 94]);

  // 8. Location Insights Card
  const insightsY = distanceY + distanceCardHeight + 3;
  const insightsCardHeight = 45;

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

/**
 * Draw a pie slice (for donut chart)
 * Uses lines() method which is available in jsPDF
 */
function drawPieSlice(doc, cx, cy, radius, startAngle, sweepAngle, color) {
  if (sweepAngle <= 0) return;

  doc.setFillColor(color[0], color[1], color[2]);

  // Convert angles to radians
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = ((startAngle + sweepAngle) * Math.PI) / 180;

  // Build path points for the pie slice
  const steps = Math.max(Math.ceil(sweepAngle / 3), 2);
  const angleStep = (endRad - startRad) / steps;

  // Start from center
  const points = [[cx, cy]];

  // Add arc points
  for (let i = 0; i <= steps; i++) {
    const angle = startRad + (i * angleStep);
    points.push([
      cx + radius * Math.cos(angle),
      cy + radius * Math.sin(angle)
    ]);
  }

  // Draw the filled polygon using lines
  if (points.length > 2) {
    // Convert to relative coordinates for jsPDF lines() method
    const linesArray = [];
    for (let i = 1; i < points.length; i++) {
      linesArray.push([
        points[i][0] - points[i-1][0],
        points[i][1] - points[i-1][1]
      ]);
    }
    // Close the path back to center
    linesArray.push([
      points[0][0] - points[points.length-1][0],
      points[0][1] - points[points.length-1][1]
    ]);

    doc.lines(linesArray, points[0][0], points[0][1], [1, 1], 'F', true);
  }
}

/**
 * Draw distance row with icon and values
 */
function drawDistanceRow(doc, x, y, width, label, distance, bgColor, iconColor) {
  const rowHeight = 12;

  // Background
  doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
  doc.roundedRect(x, y, width, rowHeight, 1.5, 1.5, 'F');

  // Icon circle
  doc.setFillColor(iconColor[0], iconColor[1], iconColor[2]);
  doc.circle(x + 6, y + rowHeight / 2, 4, 'F');

  // Icon text (use letter)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  const iconLetter = label === 'Police Station' ? 'P' : label === 'Hospital' ? 'H' : 'R';
  doc.text(iconLetter, x + 4.5, y + rowHeight / 2 + 1.5);

  // Label
  doc.setTextColor(107, 114, 128);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.text(label, x + 13, y + 4);

  // Distance value
  doc.setTextColor(31, 41, 55);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  const distStr = String(distance);
  doc.text(distStr, x + 13, y + 10);

  // "km" label
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  const distWidth = doc.getTextWidth(distStr);
  doc.text('km', x + 14 + distWidth, y + 10);

  // Right side - Distance in meters
  doc.setTextColor(107, 114, 128);
  doc.setFontSize(5);
  doc.text('Distance', x + width - 12, y + 4);
  doc.setTextColor(55, 65, 81);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  const meters = Math.round(distance * 1000);
  doc.text(`${meters}m`, x + width - 12, y + 9);
}

/**
 * Draw map placeholder when map is unavailable
 */
function drawMapPlaceholder(doc, x, y, width, height) {
  doc.setFillColor(243, 244, 246);
  doc.rect(x, y, width, height, 'F');

  doc.setTextColor(156, 163, 175);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Map unavailable', x + width / 2, y + height / 2, { align: 'center' });
  doc.setFontSize(7);
  doc.text('(Mapbox API error or token not configured)', x + width / 2, y + height / 2 + 8, { align: 'center' });
}

/**
 * Format category name (convert snake_case to Title Case)
 */
function formatCategoryName(category) {
  if (!category) return '';
  return category
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
