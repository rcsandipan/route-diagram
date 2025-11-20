
const canvas = document.getElementById('routeCanvas');
const ctx = canvas.getContext('2d');

// Track if we have drawn anything
let hasDrawnContent = false;

function drawDiagram() {
  const raw = document.getElementById('inputData').value.trim();
  const lines = raw ? raw.split('\n').map(l => l.trim()).filter(l => l) : [];
  if (lines.length === 0) {
    alert('Please enter valid data.');
    hasDrawnContent = false;
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Layout constants
  const marginX = 60;
  const maxX = canvas.width - marginX;
  const topMargin = 250;
  const rowHeight = 220;
  const roadGap = 50;
  const ofcGap = 10;
  const lowerOFCGap = 25;
  const techniqueGap = 40;
  const interSegmentGap = 5;
  
  // Process all segments and group them into rows
  const rows = [];
  let currentRow = [];
  let currentRowWidth = marginX;
  let cumulativeLength = 0;

  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split(',').map(p => p.trim());
    if (parts.length < 4) continue;

    // Check if this is a landmark entry (first part is not a number)
    const isLandmark = isNaN(parseFloat(parts[0]));
    
    let landmarkName, startLat, startLong, length, condition, technique, hasBridge, hasCulvert, coordinatesAvailable;
    
    if (isLandmark) {
      // Parse landmark data
      landmarkName = parts[0];
      startLat = parseFloat(parts[1]);
      startLong = parseFloat(parts[2]);
      length = parseFloat(parts[3]);
      condition = parts[4].toLowerCase();
      coordinatesAvailable = !(startLat === 0 && startLong === 0);
      
      technique = '';
      hasBridge = false;
      hasCulvert = false;
      
      for (let j = 5; j < parts.length; j++) {
        const part = parts[j].toLowerCase();
        if (part === 'hdd' || part === 'trenching') {
          technique = part;
        } else if (part === 'bridge') {
          hasBridge = true;
        } else if (part === 'culvert') {
          hasCulvert = true;
        }
      }
    } else {
      // Parse regular segment data
      landmarkName = null;
      startLat = parseFloat(parts[0]);
      startLong = parseFloat(parts[1]);
      length = parseFloat(parts[2]);
      condition = parts[3].toLowerCase();
      coordinatesAvailable = !(startLat === 0 && startLong === 0);
      
      technique = '';
      hasBridge = false;
      hasCulvert = false;
      
      for (let j = 4; j < parts.length; j++) {
        const part = parts[j].toLowerCase();
        if (part === 'hdd' || part === 'trenching') {
          technique = part;
        } else if (part === 'bridge') {
          hasBridge = true;
        } else if (part === 'culvert') {
          hasCulvert = true;
        }
      }
    }
    
    // Apply differential scaling based on condition and length
    let segWidth;
    if (condition === 'bad') {
      // Bad sections get emphasized with larger scale
      //segWidth = Math.max(15, Math.round(length * (emphasizeBadSections ? 1.2 : 0.8)));

      if (length > 700 && length <5000) {
    // Compress long bad sections using logarithmic scaling
    const compressionFactor = Math.max(0.1, 200 / length);
    segWidth = Math.max(15, Math.round(length * (0.8) * compressionFactor));
  } 
  
      else if (length >= 5000) {
    // Compress long bad sections using logarithmic scaling
    // const compressionFactor = Math.max(0.1, 200 / length);
    // segWidth = Math.max(15, Math.round(length * (emphasizeBadSections ? 1 : 0.8) * compressionFactor));
    segWidth = 300;
  } 
  
  else {
    // Bad sections get emphasized with larger scale
    segWidth = Math.max(15, Math.round(length * (0.8)));
  }

    } else {
      // Good sections - apply compression if > 500m
      if (length > 500 && length <5000) {
        // Compress long good sections using logarithmic scaling
        const compressionFactor = Math.max(0.1, 100 / length);
        segWidth = Math.max(10, Math.round(length * 0.8 * compressionFactor));
      } 

      else if (length >= 5000) {
        // Compress long good sections using logarithmic scaling
        // const compressionFactor = Math.max(0.1, 50 / length);
        // segWidth = Math.max(10, Math.round(length * 0.8 * compressionFactor));
        segWidth = 300;


      } 
      
      
      
      
      else {
        // Normal scaling for shorter good sections
        segWidth = Math.max(10, Math.round(length * 0.8));
      }
    }
    
    cumulativeLength += length;

    // Check if this segment fits in the current row
    if (currentRowWidth + segWidth > maxX && currentRow.length > 0) {
      // Current row is full, save it and start a new one
      rows.push(currentRow);
      currentRow = [];
      currentRowWidth = marginX;
    }
    
    // Add segment to current row
    const segment = {
      isLandmark: isLandmark,
      landmarkName: landmarkName,
      startLat,
      startLong,
      length,
      condition,
      segWidth,
      startX: currentRowWidth,
      cumulativeLength: cumulativeLength,
      hasBridge: hasBridge,
      hasCulvert: hasCulvert,
      technique: technique,
      coordinatesAvailable: coordinatesAvailable,
      compressed: (length > 500 )
    };
    
    currentRow.push(segment);
    currentRowWidth += segWidth + interSegmentGap;
  }
  
  // Add the last row if it has segments
  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  // Adjust canvas height based on number of rows
  const requiredHeight = topMargin + (rows.length * rowHeight) + 100;
  if (requiredHeight > canvas.height) {
    canvas.height = requiredHeight;
  }

  // Calculate total bad length
  let totalBadLength = 0;
  for (const row of rows) {
    for (const segment of row) {
      if (segment.condition === 'bad') totalBadLength += segment.length;
    }
  }
  
  // Draw route name at top center
  const routeName = document.getElementById('routeName').value.trim();
  ctx.fillStyle = "black";
  ctx.font = "bold 20px Arial";
  ctx.textAlign = "center";
  ctx.fillText(`Survey for OFC Rehab: ${routeName}` || 'Unnamed Route', canvas.width / 2, 40);

  ctx.textAlign = "left";
  ctx.fillStyle = "black";
  ctx.font = "16px Arial";
  ctx.textAlign = "center";
  ctx.fillText(`Total Rehab length - ${totalBadLength} Metre`, canvas.width / 2, 65);
  ctx.textAlign = "left";
 

  // Draw legends on left side
  const legendX = 20;
  const legendYStart = 10;
  const legendLineLength = 50;
  const legendGap = 15;

  ctx.lineWidth = 2;
  ctx.strokeStyle = "black";

  

  // Straight solid line - existing OFC route
  ctx.beginPath();
  ctx.setLineDash([]);
  ctx.moveTo(legendX, legendYStart);
  ctx.lineTo(legendX + legendLineLength, legendYStart);
  ctx.stroke();
  ctx.font = "14px Arial";
  ctx.fillText("Existing OFC Route", legendX + legendLineLength + 10, legendYStart + 5);

  // Dashed line - planned rehab portion
  ctx.beginPath();
  ctx.setLineDash([10, 6]);
  ctx.moveTo(legendX, legendYStart + legendGap);
  ctx.lineTo(legendX + legendLineLength, legendYStart + legendGap);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillText("Planned Rehab Portion", legendX + legendLineLength + 10, legendYStart + legendGap + 5);

  // Bold solid line - planned rehab length
  ctx.beginPath();
  ctx.lineWidth = 4;
  ctx.moveTo(legendX, legendYStart + 2 * legendGap);
  ctx.lineTo(legendX + legendLineLength, legendYStart + 2 * legendGap);
  ctx.stroke();
  ctx.lineWidth = 2; // reset line width
  ctx.fillText("Planned Rehab Length(HDD)", legendX + legendLineLength + 10, legendYStart + 2 * legendGap + 5);

  ctx.beginPath();
  ctx.setLineDash([15, 3]);
  ctx.lineWidth = 4;
  ctx.moveTo(legendX, legendYStart + 3 * legendGap); // Adjusted vertical position here
  ctx.lineTo(legendX + legendLineLength, legendYStart + 3 * legendGap);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = 2; // reset line width
  ctx.fillText("Planned Rehab Length(Trenching)", legendX + legendLineLength + 10, legendYStart + 3 * legendGap + 5);


  ctx.textAlign = "left";
  ctx.fillStyle = "black";
  ctx.font = "12px Arial";
  ctx.textAlign = "right";
  ctx.fillText(`SDE(Tx-Mtce)`, canvas.width -60, canvas.height-90);

  ctx.textAlign = "left";
  ctx.fillStyle = "black";
  ctx.font = "12px Arial";
  ctx.textAlign = "right";
  ctx.fillText(`SDE(Tx-Plg & Inst)`, 3*canvas.width/4, canvas.height-90);

  ctx.textAlign = "left";
  ctx.fillStyle = "black";
  ctx.font = "12px Arial";
  ctx.textAlign = "centre";
  ctx.fillText(`AGM(Tx)`, canvas.width/4, canvas.height-90);

  ctx.textAlign = "left";
  ctx.fillStyle = "black";
  ctx.font = "12px Arial";
  ctx.textAlign = "left";
  ctx.fillText(`DGM(Tx)`, 100, canvas.height-90);

  // Draw each row
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const rowY = topMargin + (r * rowHeight);
    
    drawRoad(row, rowY, roadGap);
    drawOFCLines(row, rowY, ofcGap, roadGap);
    drawLowerOFCForRow(row, rowY, lowerOFCGap, roadGap);
    drawCumulativeLengths(row, rowY, ofcGap, roadGap);
    drawTechniqueMarkings(row, rowY, roadGap, techniqueGap);
    
    // Draw row number
    ctx.fillStyle = "black";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "left";
  }

  // Title and statistics
  ctx.fillStyle = "black";
  ctx.font = "bold 16px Arial";
  ctx.textAlign = "center";
  
  ctx.font = "14px Arial";
  ctx.textAlign = "left";

  // Mark that we have drawn content
  hasDrawnContent = true;
}

function drawRoad(row, rowY, roadGap) {
  if (!row || row.length === 0) return;

  const roadTop = rowY - roadGap / 2;
  const roadBottom = rowY + roadGap / 2;

  const roadStartX = row[0].startX;
  const roadEndX = row[row.length - 1].startX + row[row.length - 1].segWidth;
  const roadWidth = roadEndX - roadStartX;

  // Draw road fill
  ctx.fillStyle = "#d9d9d9";
  ctx.fillRect(roadStartX, roadTop, roadWidth, roadGap);

  // Draw road borders
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = "black";
  ctx.beginPath();
  ctx.moveTo(roadStartX, roadTop);
  ctx.lineTo(roadEndX, roadTop);
  ctx.moveTo(roadStartX, roadBottom);
  ctx.lineTo(roadEndX, roadBottom);
  ctx.stroke();

  // Draw road label
  ctx.fillStyle = "black";
  ctx.font = " 11px Arial";
  ctx.textAlign = "center";
  ctx.fillText("", (roadStartX + roadEndX) / 2, rowY + 4);
  ctx.textAlign = "left";
}

function drawOFCLines(row, rowY, ofcGap, roadGap) {
  const roadTop = rowY - roadGap / 2;
  const ofcY = roadTop - ofcGap;
  
  // Draw OFC line label
  ctx.fillStyle = "black";
  ctx.font = "bold 11px Arial";
  ctx.textAlign = "center";
  ctx.fillText("OFC", row[0].startX - 40, ofcY);
  ctx.textAlign = "left";
  
  // Draw OFC line for each segment in the row
  for (const segment of row) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = "black";
    
    // Handle different conditions
    if (segment.condition === 'bad') {
      if (segment.hasBridge) {
        // Draw bridge symbol instead of dashed line
        drawBridgeSymbol(segment.startX, ofcY, segment.segWidth, segment.length);
      } else if (segment.hasCulvert) {
        // Draw culvert symbol instead of dashed line
        drawCulvertSymbol(segment.startX, ofcY, segment.segWidth, segment.length);
      } else {
        // Regular bad condition - dashed line
        ctx.setLineDash([10, 6]);
        ctx.beginPath();
        ctx.moveTo(segment.startX, ofcY);
        ctx.lineTo(segment.startX + segment.segWidth, ofcY);
        ctx.stroke();
        ctx.setLineDash([]);

        if (segment.compressed) {
      drawBreakSymbol(segment.startX + segment.segWidth / 2, ofcY);
    }
      }
    } else {
      // Good condition - solid line
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(segment.startX, ofcY);
      ctx.lineTo(segment.startX + segment.segWidth, ofcY);
      ctx.stroke();
      
      // Add compression indicator for compressed good sections
      if (segment.compressed) {
         drawBreakSymbol(segment.startX + segment.segWidth / 2, ofcY);
        ctx.fillStyle = "red";
        ctx.font = "bold 10px Arial";
        ctx.textAlign = "center";
        //ctx.fillText(`SCALED-DOWN`, segment.startX + segment.segWidth / 2, ofcY - 15);
        ctx.textAlign = "left";
      }
    }
    
    // Draw landmark/coordinate label
    ctx.save();
    const labelY = roadTop - 20;
    ctx.translate(segment.startX - 2, labelY);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "black";
    ctx.font = "bold 10px Arial";
    
    // For landmarks, always show the landmark name
    if (segment.isLandmark) {
      ctx.fillText(segment.landmarkName, 0, 0);
      if (segment.coordinatesAvailable) {
        
        ctx.fillText(`(${segment.startLat.toFixed(4)}, ${segment.startLong.toFixed(4)})`,
            0,
            12                 // <-- gap (12px below)
        );
      
    } 
  }
  else {
      // For regular segments, only show coordinates if available
      if (segment.coordinatesAvailable) {
        ctx.fillText(`(${segment.startLat.toFixed(4)}, ${segment.startLong.toFixed(4)})`, 0, 0);
      }
    }
  
    ctx.restore();

    // Draw segment length below each segment
    ctx.fillStyle = segment.compressed ? "black" : "black";
    ctx.font = segment.compressed ? "bold 10px Arial" : "10px Arial";
    ctx.textAlign = "center";
    if(segment.length!=0){
      ctx.fillText(`${segment.length}m`, segment.startX + segment.segWidth / 2, ofcY + 20);
    }
    else{
      ctx.fillText(``, segment.startX + segment.segWidth / 2, ofcY + 20);
    }
    
    ctx.textAlign = "left";
  }
}

function drawBreakSymbol(centerX, y) {
  
  ctx.restore();

  ctx.save();
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;

    const dashLen = 35;   // length of left/right straight lines
    const slashGap = 4;   // small gap before slashes
    const slashW = 5;     // width of each slash
    const slashH = 12;    // height of each slash (slant)

    
    // TWO SLANTED SLASHES "//"
    let sx = centerX; // first slash center

    // First slash "/"
    ctx.beginPath();
    ctx.moveTo(sx - slashW, y - slashH / 2);
    ctx.lineTo(sx + slashW, y + slashH / 2);
    ctx.stroke();

    // Second slash "/" (slightly shifted)
    ctx.beginPath();
    ctx.moveTo(sx + slashW + 3, y - slashH / 2);
    ctx.lineTo(sx + 3 + slashW + slashW, y + slashH / 2);
    ctx.stroke();

  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.moveTo(sx+2, y);
  ctx.lineTo(sx+10, y);
  ctx.stroke();
  ctx.globalCompositeOperation = 'source-over'; // Reset to default
    ctx.restore();
}

function drawBridgeSymbol(startX, y, width, length) {
  const centerX = startX + width / 2;
  const bridgeHeight = 15;
  const archCount = Math.max(3, Math.floor(width / 20));
  
  // Draw bridge base (solid line)
  ctx.setLineDash([]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "black";
  ctx.beginPath();
  ctx.moveTo(startX, y);
  ctx.lineTo(startX + width, y);
  ctx.stroke();
  
  // Draw bridge arches
  ctx.strokeStyle = "black";
  ctx.lineWidth = 1.5;
  
  const archSpacing = width / (archCount + 1);
  for (let i = 1; i <= archCount; i++) {
    const archX = startX + i * archSpacing;
    
    // Draw arch
    ctx.beginPath();
    ctx.moveTo(archX - archSpacing/2, y);
    ctx.quadraticCurveTo(archX, y - bridgeHeight, archX + archSpacing/2, y);
    ctx.stroke();
    
    // Draw vertical supports
    ctx.beginPath();
    ctx.moveTo(archX - archSpacing/3, y);
    ctx.lineTo(archX - archSpacing/3, y + 3);
    ctx.moveTo(archX + archSpacing/3, y);
    ctx.lineTo(archX + archSpacing/3, y + 3);
    ctx.stroke();
  }
  
  // Draw bridge label
  ctx.save();
  ctx.fillStyle = "black";
  ctx.font = "bold 11px Arial";
  ctx.textAlign = "center";
  ctx.translate(centerX, y - bridgeHeight - 25);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(`Bridge ${length}m`, 0, 0);
  ctx.restore();
}

function drawCulvertSymbol(startX, y, width, length) {
  const centerX = startX + width / 2;
  const culvertHeight = 12;
  const pipeCount = Math.max(2, Math.floor(width / 25));
  
  // Draw culvert base (solid line)
  ctx.setLineDash([]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "black";
  ctx.beginPath();
  ctx.moveTo(startX, y);
  ctx.lineTo(startX + width, y);
  ctx.stroke();
  
  // Draw culvert pipes
  ctx.strokeStyle = "black";
  ctx.lineWidth = 1.5;
  
  const pipeSpacing = width / (pipeCount + 1);
  for (let i = 1; i <= pipeCount; i++) {
    const pipeX = startX + i * pipeSpacing;
    
    // Draw pipe (circle)
    ctx.beginPath();
    ctx.arc(pipeX, y - culvertHeight/2, culvertHeight/2, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw pipe ends
    ctx.beginPath();
    ctx.moveTo(pipeX - culvertHeight/2, y - culvertHeight/2);
    ctx.lineTo(pipeX - culvertHeight/2 - 2, y - culvertHeight/2);
    ctx.moveTo(pipeX + culvertHeight/2, y - culvertHeight/2);
    ctx.lineTo(pipeX + culvertHeight/2 + 2, y - culvertHeight/2);
    ctx.stroke();
  }
  
  // Draw culvert label
  ctx.save();
  ctx.fillStyle = "black";
  ctx.font = "bold 11px Arial";
  ctx.textAlign = "center";
  ctx.translate(centerX, y - culvertHeight - 35);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(`Culvert ${length}m`, 0, 0);
  ctx.restore();
}

function drawLowerOFCForRow(row, rowY, lowerOFCGap, roadGap) {
  const roadBottom = rowY + roadGap / 2;
  const lowerY = roadBottom + lowerOFCGap;
  
  // Draw lower OFC label
  ctx.fillStyle = "black";
  ctx.font = "bold 11px Arial";
  ctx.textAlign = "center";
  ctx.fillText("REHAB", row[0].startX - 30, lowerY);
  ctx.textAlign = "left";

  for (const segment of row) {
    if (segment.condition === 'bad') {
      ctx.lineWidth = 4;
      ctx.strokeStyle = "black";
      if (segment.technique === "trenching") {
        ctx.setLineDash([15, 3]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.beginPath();
      ctx.moveTo(segment.startX, lowerY);
      ctx.lineTo(segment.startX + segment.segWidth, lowerY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

function drawCumulativeLengths(row, rowY, ofcGap, roadGap) {
  const roadTop = rowY - roadGap / 2;
  const ofcY = roadTop - ofcGap;
  
  ctx.fillStyle = "black";
  ctx.font = "bold 11px Arial";
  ctx.textAlign = "center";
  
  for (const segment of row) {
    const endX = segment.startX + segment.segWidth;
    
    // Draw the cumulative length text vertically
    ctx.save();
    ctx.translate(endX, ofcY + 35);
    ctx.rotate(-Math.PI / 2);
    if (segment.length != 0)
  {
    ctx.fillText(`${segment.cumulativeLength} M`, 0, 0);
  } else{
    ctx.fillText(``, 0, 0);
  }
    

    ctx.restore();
    
    // Draw a small vertical marker at the end of each segment
    if(segment.length!=0){
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(endX, ofcY - 5);
    ctx.lineTo(endX, ofcY + 5);
    ctx.stroke();
    }
    
  }
  
  // Reset text alignment
  ctx.textAlign = "left";
}

function drawTechniqueMarkings(row, rowY, roadGap, techniqueGap) {
  const roadBottom = rowY + roadGap / 2;
  const techniqueY = roadBottom + techniqueGap;
  
  // Group consecutive bad segments with the same technique
  const techniqueGroups = [];
  let currentGroup = null;
  
  for (let i = 0; i < row.length; i++) {
    const segment = row[i];
    
    // Check if this segment has a technique and is bad condition
    if (segment.condition === 'bad' && segment.technique) {
      if (currentGroup && currentGroup.technique === segment.technique) {
        // Continue current group - extend the end position
        currentGroup.endX = segment.startX + segment.segWidth;
        currentGroup.totalLength += segment.length;
        currentGroup.segments.push(segment);
      } else {
        // End previous group if exists
        if (currentGroup) {
          techniqueGroups.push(currentGroup);
        }
        // Start new group
        currentGroup = {
          technique: segment.technique,
          startX: segment.startX,
          endX: segment.startX + segment.segWidth,
          totalLength: segment.length,
          segments: [segment]
        };
      }
    } else {
      // End current group if it exists
      if (currentGroup) {
        techniqueGroups.push(currentGroup);
        currentGroup = null;
      }
    }
  }
  
  // Don't forget the last group
  if (currentGroup) {
    techniqueGroups.push(currentGroup);
  }
  
  // Draw technique markings for each group
  for (const group of techniqueGroups) {
    const centerX = (group.startX + group.endX) / 2;
    
    // Draw technique text
    ctx.fillStyle = "black";
    ctx.font = "bold 11px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`${group.technique.toUpperCase()} (${group.totalLength}m)`, centerX, techniqueY);
  }
}

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  document.getElementById('inputData').value = '';
  // Reset canvas to original height
  canvas.height = 900;
  hasDrawnContent = false;
}

// PDF Export Function
function exportToPDF() {
  // Check if we have drawn content
  if (!hasDrawnContent) {
    alert('Please draw a diagram first before exporting to PDF.');
    return;
  }

  // Create a new jsPDF instance
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'px',
    format: [canvas.width, canvas.height]
  });

  // Convert canvas to image data
  const imgData = canvas.toDataURL('image/png');
  
  // Add the image to PDF
  pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
  
  // Get route name for filename
  const routeName = document.getElementById('routeName').value.trim() || 'OFC_Route_Diagram';
  
  // Save the PDF
  pdf.save(`${routeName}_diagram.pdf`);
}
