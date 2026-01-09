import { asyncHandler } from '../middleware/errorHandler.js';
import { jsPDF } from 'jspdf';
import { SurveyResult } from '../models/SurveyResult.js';

/**
 * Export Report PDF
 * Generates a PDF report for the survey analysis
 * Layout matches the original Base44 export function
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

  // Color palette matching POIDonutChart
  const COLORS = [
    [91, 141, 238], [139, 127, 214], [231, 76, 60], [230, 126, 34],
    [243, 156, 18], [241, 196, 15], [212, 225, 87], [156, 204, 101],
    [102, 187, 106], [38, 166, 154], [77, 208, 225], [79, 195, 247],
    [186, 104, 200], [236, 64, 122], [255, 112, 67], [141, 110, 99],
    [120, 144, 156], [161, 136, 127]
  ];

  // ===== PAGE 1 HEADER =====
  // Logo
  const logoUrl = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e4844ed620b4351643b737/8903325f1_GISACCESS_LOGO1.png';
  try {
    const logoResponse = await fetch(logoUrl);
    if (logoResponse.ok) {
      const logoBuffer = await logoResponse.arrayBuffer();
      const logoBase64 = Buffer.from(logoBuffer).toString('base64');
      doc.addImage(`data:image/png;base64,${logoBase64}`, 'PNG', 15, 10, 40, 12);
    }
  } catch (error) {
    console.error('Failed to load logo:', error);
  }

  // Title
  doc.setTextColor(31, 41, 55);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('Land Survey & Infrastructure Analysis', 105, 18, { align: 'center' });

  // Division and Survey Number
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(`Division : ${result.village}`, 15, 32);
  doc.text(`Survey number : ${result.survey_number}`, 140, 32);
  
  // === MAIN CONTENT BELOW HEADER ===
  let y = 40;
  
  // LEFT COLUMN: Nearby Points of Interest
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(10, y, 125, 145, 2, 2, 'F');
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(10, y, 125, 145, 2, 2, 'S');
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Nearby Points of Interest', 15, y + 8);

  // POI Legend - Two columns
  doc.setFontSize(7);
  const poiBreakdown = (result.poi_breakdown || []).slice(0, 18);
  const midPoint = Math.ceil(poiBreakdown.length / 2);
  const leftColumn = poiBreakdown.slice(0, midPoint);
  const rightColumn = poiBreakdown.slice(midPoint);

  let leftY = y + 16;
  leftColumn.forEach((poi, index) => {
    const color = COLORS[index % COLORS.length];
    // Colored circle
    doc.setFillColor(...color);
    doc.circle(17, leftY - 1.5, 2, 'F');
    
    // Count (bold)
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(`${poi.count}`, 21, leftY);
    
    // Percentage (gray)
    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', 'normal');
    doc.text(`(${poi.percent}%)`, 28, leftY);
    
    // Category name
    doc.setTextColor(55, 65, 81);
    const categoryText = poi.category.length > 20 ? poi.category.substring(0, 20) : poi.category;
    doc.text(categoryText, 42, leftY);
    
    leftY += 5;
  });

  let rightY = y + 16;
  rightColumn.forEach((poi, index) => {
    const colorIndex = midPoint + index;
    const color = COLORS[colorIndex % COLORS.length];
    // Colored circle
    doc.setFillColor(...color);
    doc.circle(72, rightY - 1.5, 2, 'F');
    
    // Count (bold)
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(`${poi.count}`, 76, rightY);
    
    // Percentage (gray)
    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', 'normal');
    doc.text(`(${poi.percent}%)`, 83, rightY);
    
    // Category name
    doc.setTextColor(55, 65, 81);
    const categoryText = poi.category.length > 20 ? poi.category.substring(0, 20) : poi.category;
    doc.text(categoryText, 97, rightY);
    
    rightY += 5;
  });

  // FTL Zone Analysis (Left Column, below POI)
  let ftlY = y + 100;
  const rawFtlPercentage = result.ftl_zone_percentage || 0;
  const ftlPercentage = rawFtlPercentage > 9 ? Math.round(rawFtlPercentage) : 0;
  
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(10, ftlY, 125, 45, 2, 2, 'F');
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(10, ftlY, 125, 45, 2, 2, 'S');
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('FTL Zone Analysis', 15, ftlY + 8);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text('Full Tank Level Risk Assessment', 15, ftlY + 14);
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(31, 41, 55);
  doc.text(`Chance of falling in FTL zone: ${ftlPercentage}%`, 15, ftlY + 22);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(55, 65, 81);
  const ftlRiskText = ftlPercentage === 0 
    ? 'This survey location does not fall within any FTL (Full Tank Level) zones. No water body restrictions apply.'
    : `This survey location falls within an FTL zone. Construction restrictions may apply.`;
  const ftlLines = doc.splitTextToSize(ftlRiskText, 115);
  doc.text(ftlLines, 15, ftlY + 28);
  
  doc.setFontSize(7);
  doc.setTextColor(107, 114, 128);
  doc.text('Note: FTL zones indicate areas within tank/water body jurisdictions where construction restrictions apply.', 15, ftlY + 38);

  // Survey Location Map (Left Column, bottom)
  let mapY = ftlY + 50;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(10, mapY, 125, 95, 2, 2, 'F');
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(10, mapY, 125, 95, 2, 2, 'S');
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Survey Location Map', 15, mapY + 8);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text('10-minute walking radius with POIs and amenities', 15, mapY + 14);
  
  // Generate Mapbox Static Image
  if (result.map_data && result.latitude && result.longitude) {
    const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;
    const lat = result.latitude;
    const lon = result.longitude;
    
    if (MAPBOX_TOKEN) {
      // Build markers overlay
      let overlays = [];
      // Survey location (red large pin)
      overlays.push(`pin-l+ff0000(${lon},${lat})`);
      
      // Add amenity markers if available
      if (result.map_data.nearest_police) {
        overlays.push(`pin-s-embassy+3b82f6(${result.map_data.nearest_police.lon},${result.map_data.nearest_police.lat})`);
      }
      if (result.map_data.nearest_hospital) {
        overlays.push(`pin-s-hospital+ef4444(${result.map_data.nearest_hospital.lon},${result.map_data.nearest_hospital.lat})`);
      }
      if (result.map_data.nearest_road) {
        overlays.push(`pin-s-marker+22c55e(${result.map_data.nearest_road.lon},${result.map_data.nearest_road.lat})`);
      }
      
      const overlayString = overlays.join(',');
      // Mapbox Static Images API URL
      // Format: /styles/v1/{style_id}/static/{overlay}/{lon},{lat},{zoom},{bearing},{pitch}/{width}x{height}
      // Note: Isochrone overlay would require additional processing (polyline encoding or separate overlay layer)
      // For now, we show markers. Isochrone can be added as a separate overlay layer if needed.
      const mapUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${overlayString}/${lon},${lat},14,0/500x400?access_token=${MAPBOX_TOKEN}`;
      
      try {
        console.log('🗺️  Fetching Mapbox static image for PDF...');
        const mapResponse = await fetch(mapUrl);
        
        // Validate content type
        const contentType = mapResponse.headers.get('content-type');
        if (mapResponse.ok && contentType && contentType.startsWith('image/')) {
          const mapImageBuffer = await mapResponse.arrayBuffer();
          const mapImageBase64 = Buffer.from(mapImageBuffer).toString('base64');
          
          // Add map image to PDF (fit within the box: 115mm width, 75mm height)
          doc.addImage(`data:image/png;base64,${mapImageBase64}`, 'PNG', 15, mapY + 20, 115, 70);
          console.log('✅ Map image added to PDF');
        } else {
          throw new Error(`Invalid response: ${contentType || mapResponse.status}`);
        }
      } catch (error) {
        console.error('❌ Failed to fetch map image:', error.message);
        // Add placeholder text if map fails
        doc.setTextColor(107, 114, 128);
        doc.setFontSize(9);
        doc.text('Map unavailable', 72.5, mapY + 55, { align: 'center' });
        doc.setFontSize(7);
        doc.text('(Mapbox API error)', 72.5, mapY + 62, { align: 'center' });
      }
    } else {
      // No Mapbox token
      doc.setTextColor(107, 114, 128);
      doc.setFontSize(9);
      doc.text('Map unavailable', 72.5, mapY + 55, { align: 'center' });
      doc.setFontSize(7);
      doc.text('(Mapbox token not configured)', 72.5, mapY + 62, { align: 'center' });
    }
  } else {
    // No map data
    doc.setTextColor(107, 114, 128);
    doc.setFontSize(9);
    doc.text('Map data not available', 72.5, mapY + 55, { align: 'center' });
  }
  
  // Map Legend (below map, within the box)
  // Map image ends at mapY + 20 + 70 = mapY + 90, so legend starts at mapY + 92
  let legendY = mapY + 92;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Legend:', 15, legendY);
  
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(55, 65, 81);
  legendY += 4;
  
  // Survey Location
  doc.setFillColor(255, 0, 0);
  doc.circle(17, legendY - 1, 1, 'F');
  doc.text('Survey', 20, legendY);
  
  // Police Station
  doc.setFillColor(59, 130, 246);
  doc.circle(45, legendY - 1, 1, 'F');
  doc.text('Police', 48, legendY);
  
  // Hospital
  doc.setFillColor(239, 68, 68);
  doc.circle(70, legendY - 1, 1, 'F');
  doc.text('Hospital', 73, legendY);
  
  // Main Road
  doc.setFillColor(34, 197, 94);
  doc.circle(100, legendY - 1, 1, 'F');
  doc.text('Road', 103, legendY);
  
  // RIGHT COLUMN: Development Score
  let rightColY = 54;
  const devScore = result.development_score || 0;
  const scoreColor = devScore >= 80 ? [220, 252, 231] : devScore >= 60 ? [219, 234, 254] : devScore >= 40 ? [254, 249, 195] : [254, 226, 226];
  const scoreTextColor = devScore >= 80 ? [22, 163, 74] : devScore >= 60 ? [37, 99, 235] : devScore >= 40 ? [202, 138, 4] : [220, 38, 38];

  doc.setFillColor(...scoreColor);
  doc.roundedRect(140, rightColY, 60, 50, 2, 2, 'F');
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(140, rightColY, 60, 50, 2, 2, 'S');

  // Title
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Development Score', 145, rightColY + 8);
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text('Overall location quality assessment', 145, rightColY + 13);

  // Score
  doc.setFontSize(24);
  doc.setTextColor(...scoreTextColor);
  doc.setFont('helvetica', 'bold');
  doc.text(`${devScore}`, 145, rightColY + 25);
  doc.setFontSize(12);
  doc.text('/100', 145 + doc.getTextWidth(`${devScore}`) + 1, rightColY + 25);

  // Level
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const scoreLevel = devScore >= 80 ? 'Excellent' : devScore >= 60 ? 'Good' : devScore >= 40 ? 'Average' : 'Needs Improvement';
  doc.setTextColor(107, 114, 128);
  doc.text(scoreLevel, 145, rightColY + 32);
  
  // Score Breakdown
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Score Breakdown:', 145, rightColY + 40);
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  const breakdown = result.score_breakdown || {};
  let breakdownY = rightColY + 46;
  const breakdownItems = [
    { label: 'POI Count & Diversity', score: breakdown.poi_score || 0, max: 30 },
    { label: 'Proximity to Amenities', score: breakdown.amenity_score || 0, max: 25 },
    { label: 'FTL Zone Safety', score: breakdown.ftl_score || 0, max: 20 },
    { label: 'Supportive Businesses', score: breakdown.business_score || 0, max: 15 },
    { label: 'Overall Accessibility', score: breakdown.accessibility_score || 0, max: 10 }
  ];
  
  breakdownItems.forEach(item => {
    doc.setTextColor(55, 65, 81);
    doc.text(`${item.label}: ${item.score.toFixed(1)}/${item.max}`, 145, breakdownY);
    breakdownY += 5;
  });

  // Distance to Key Amenities
  rightColY = 110;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(140, rightColY, 60, 80, 2, 2, 'F');
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(140, rightColY, 60, 80, 2, 2, 'S');
  
  // Title
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Distance to Key Amenities', 145, rightColY + 7);

  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text('Nearest facilities from location', 145, rightColY + 12);

  // Police Station Card
  rightColY += 18;
  doc.setFillColor(219, 234, 254); // Blue-100
  doc.roundedRect(143, rightColY, 54, 18, 2, 2, 'F');
  
  // Icon box
  doc.setFillColor(59, 130, 246); // Blue-500
  doc.roundedRect(145, rightColY + 3, 10, 10, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text('🛡', 147, rightColY + 10);
  
  // Police Station text
  doc.setTextColor(107, 114, 128);
  doc.setFontSize(7);
  doc.text('Police Station', 158, rightColY + 6);
  
  // Distance
  doc.setTextColor(31, 41, 55);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const policeDist = result.distance_to_police || 0;
  doc.text(`${policeDist}`, 158, rightColY + 13);
  doc.setFontSize(8);
  doc.setTextColor(75, 85, 99);
  doc.setFont('helvetica', 'normal');
  doc.text('km', 158 + doc.getTextWidth(`${policeDist}`) + 1, rightColY + 13);
  
  // Distance label (right side)
  doc.setTextColor(107, 114, 128);
  doc.setFontSize(6);
  doc.text('Distance', 178, rightColY + 6);
  doc.setTextColor(55, 65, 81);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(`${(policeDist * 1000).toFixed(0)}m`, 178, rightColY + 13);
  
  // Hospital Card
  rightColY += 20;
  doc.setFillColor(254, 226, 226); // Red-100
  doc.roundedRect(143, rightColY, 54, 18, 2, 2, 'F');
  
  // Icon box
  doc.setFillColor(239, 68, 68); // Red-500
  doc.roundedRect(145, rightColY + 3, 10, 10, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text('HOSP', 147, rightColY + 10);
  
  // Hospital text
  doc.setTextColor(107, 114, 128);
  doc.setFontSize(7);
  doc.text('Hospital', 158, rightColY + 6);
  
  // Distance
  doc.setTextColor(31, 41, 55);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const hospitalDist = result.distance_to_hospital || 0;
  doc.text(`${hospitalDist}`, 158, rightColY + 13);
  doc.setFontSize(8);
  doc.setTextColor(75, 85, 99);
  doc.setFont('helvetica', 'normal');
  doc.text('km', 158 + doc.getTextWidth(`${hospitalDist}`) + 1, rightColY + 13);
  
  // Distance label
  doc.setTextColor(107, 114, 128);
  doc.setFontSize(6);
  doc.text('Distance', 178, rightColY + 6);
  doc.setTextColor(55, 65, 81);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(`${(hospitalDist * 1000).toFixed(0)}m`, 178, rightColY + 13);
  
  // Main Road Card
  rightColY += 20;
  doc.setFillColor(220, 252, 231); // Green-100
  doc.roundedRect(143, rightColY, 54, 18, 2, 2, 'F');
  
  // Icon box
  doc.setFillColor(34, 197, 94); // Green-500
  doc.roundedRect(145, rightColY + 3, 10, 10, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text('🛣', 147, rightColY + 10);
  
  // Main Road text
  doc.setTextColor(107, 114, 128);
  doc.setFontSize(7);
  doc.text('Main Road', 158, rightColY + 6);
  
  // Distance
  doc.setTextColor(31, 41, 55);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const roadDist = result.distance_to_main_road || 0;
  doc.text(`${roadDist}`, 158, rightColY + 13);
  doc.setFontSize(8);
  doc.setTextColor(75, 85, 99);
  doc.setFont('helvetica', 'normal');
  doc.text('km', 158 + doc.getTextWidth(`${roadDist}`) + 1, rightColY + 13);
  
  // Distance label
  doc.setTextColor(107, 114, 128);
  doc.setFontSize(6);
  doc.text('Distance', 178, rightColY + 6);
  doc.setTextColor(55, 65, 81);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(`${(roadDist * 1000).toFixed(0)}m`, 178, rightColY + 13);

  // Location Insights
  rightColY += 25;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(140, rightColY, 60, 40, 2, 2, 'F');
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(140, rightColY, 60, 40, 2, 2, 'S');
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Location Insights', 145, rightColY + 8);
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text('Key observations and recommendations', 145, rightColY + 13);
  
  doc.setFontSize(8);
  doc.setTextColor(55, 65, 81);
  const insightText = devScore >= 80 
    ? 'Highly Recommended: Excellent location with strong infrastructure, good connectivity, and minimal restrictions. Ideal for residential or commercial development.'
    : devScore >= 60
    ? 'Recommended: Good location with decent infrastructure and connectivity. Suitable for development with minor considerations.'
    : devScore >= 40
    ? 'Moderate: Average location with some limitations. Development possible with careful planning.'
    : 'Needs Improvement: Location has significant limitations. Consider alternative locations or extensive planning.';
  const insightLines = doc.splitTextToSize(insightText, 55);
  doc.text(insightLines, 145, rightColY + 20);

  // Analysis Details
  rightColY += 45;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(140, rightColY, 60, 35, 2, 2, 'F');
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(140, rightColY, 60, 35, 2, 2, 'S');
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Analysis Details', 145, rightColY + 8);
  
  // Coordinates
  rightColY += 12;
  doc.setTextColor(107, 114, 128);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Coordinates', 145, rightColY);
  doc.setTextColor(31, 41, 55);
  doc.setFontSize(7);
  doc.text(`${result.latitude.toFixed(6)}, ${result.longitude.toFixed(6)}`, 145, rightColY + 5);
  
  // Analysis Date
  rightColY += 10;
  doc.setTextColor(107, 114, 128);
  doc.setFontSize(7);
  doc.text('Analysis Date', 145, rightColY);
  doc.setTextColor(31, 41, 55);
  doc.setFontSize(7);
  const analysisDate = result.analysis_date ? new Date(result.analysis_date) : new Date();
  doc.text(analysisDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }), 145, rightColY + 5);

  // === FOOTER ===
  doc.setDrawColor(229, 231, 235);
  doc.line(15, 280, 195, 280);
  
  doc.setTextColor(156, 163, 175);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Generated by Land Survey Analytics Platform • Powered by GISACCESS PVT LTD', 105, 287, { align: 'center' });
  doc.text('Page 1 of 1', 105, 292, { align: 'center' });

  // Generate PDF as buffer
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

  // Return PDF
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${result.village}_${result.survey_number}.pdf`);
  res.send(pdfBuffer);
});
