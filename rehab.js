// rehab.js - rewritten to use per-row offscreen canvases and multi-page PDF export

if (sessionStorage.getItem('isLoggedIn') !== 'true') {
  window.location.href = 'index.html';
}

const canvas = document.getElementById('routeCanvas');
const ctx = canvas.getContext('2d');

const drawBtn = document.getElementById('drawBtn');
const clearBtn = document.getElementById('clearBtn');
const exportBtn = document.getElementById('exportBtn');




let hasDrawnContent = false;

// Configuration / layout constants
const CANVAS_WIDTH = 1300;
canvas.width = CANVAS_WIDTH;

const MARGIN_X = 60;
const ROW_HEIGHT = 300;        // per-row canvas height (you may adjust)
const TOP_MARGIN = 150;       // header area (title + legend)
const ROAD_GAP = 50;
const OFC_GAP = 10;
const LOWER_OFC_GAP = 25;
const TECHNIQUE_GAP = 40;
const INTER_SEGMENT_GAP = 5;

let rowCanvases = [];  // will hold canvases for each row
let headerCanvas = null; // header (title + legend + summary)

// UTIL: px -> mm conversion (assume 96dpi)
const PX_TO_MM = 25.4 / 96;

// ---------- Entry points ----------
drawBtn.onclick = () => {
  drawDiagram();
};
clearBtn.onclick = () => {
  clearCanvas();
};
exportBtn.onclick = () => {
  exportToPDF();
};

// ---------- Main diagram flow ----------
function drawDiagram() {
  const raw = document.getElementById('inputData').value.trim();
  const lines = raw ? raw.split('\n').map(l => l.trim()).filter(l => l) : [];
  if (lines.length === 0) {
    alert('Please enter valid data.');
    hasDrawnContent = false;
    return;
  }

  // Parse segments and group rows (same parsing logic as original)
  const rows = buildRowsFromLines(lines);

  // Create header canvas (title + legend + signatories + total rehab length)
  headerCanvas = createHeaderCanvas(rows);

  // Create per-row offscreen canvases
  rowCanvases = rows.map((row, idx) => createRowCanvas(row, idx));

  // Composite header + rows onto main visible canvas for preview
  compositePreviewCanvas();

  hasDrawnContent = true;
}

// ---------- Parsing / row layout ----------
function buildRowsFromLines(lines) {
  const maxX = CANVAS_WIDTH - MARGIN_X;
  const rows = [];
  let currentRow = [];
  let currentRowWidth = MARGIN_X;
  let cumulativeLength = 0;

  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split(',').map(p => p.trim());
    if (parts.length < 4) continue;

    const isLandmark = isNaN(parseFloat(parts[0]));

    let landmarkName = null;
    let startLat = 0;
    let startLong = 0;
    let length = 0;
    let condition = 'good';
    let technique = '';
    let hasBridge = false;
    let hasCulvert = false;
    let coordinatesAvailable = false;

    if (isLandmark) {
      landmarkName = parts[0];
      startLat = parseFloat(parts[1]) || 0;
      startLong = parseFloat(parts[2]) || 0;
      length = parseFloat(parts[3]) || 0;
      condition = (parts[4] || 'good').toLowerCase();
      coordinatesAvailable = !(startLat === 0 && startLong === 0);

      for (let j = 5; j < parts.length; j++) {
        const p = parts[j].toLowerCase();
        if (p === 'hdd' || p === 'trenching') technique = p;
        if (p === 'bridge') hasBridge = true;
        if (p === 'culvert') hasCulvert = true;
      }
    } else {
      // regular numeric coordinates first
      startLat = parseFloat(parts[0]) || 0;
      startLong = parseFloat(parts[1]) || 0;
      length = parseFloat(parts[2]) || 0;
      condition = (parts[3] || 'good').toLowerCase();
      coordinatesAvailable = !(startLat === 0 && startLong === 0);

      for (let j = 4; j < parts.length; j++) {
        const p = parts[j].toLowerCase();
        if (p === 'hdd' || p === 'trenching') technique = p;
        if (p === 'bridge') hasBridge = true;
        if (p === 'culvert') hasCulvert = true;
      }
    }

    // compute segWidth (scaling rules similar to your original)
    let segWidth = computeSegmentWidth(length, condition);

    cumulativeLength += length;

    // wrap to next row if won't fit
    if (currentRowWidth + segWidth > maxX && currentRow.length > 0) {
      rows.push(currentRow);
      currentRow = [];
      currentRowWidth = MARGIN_X;
    }

    const segment = {
      isLandmark,
      landmarkName,
      startLat,
      startLong,
      length,
      condition,
      segWidth,
      startX: currentRowWidth,
      cumulativeLength,
      hasBridge,
      hasCulvert,
      technique,
      coordinatesAvailable,
      compressed: (length > 500)
    };

    currentRow.push(segment);
    currentRowWidth += segWidth + INTER_SEGMENT_GAP;
  }

  if (currentRow.length > 0) rows.push(currentRow);
  return rows;
}

function computeSegmentWidth(length, condition) {
  if (condition === 'bad') {
    if (length > 700 && length < 5000) {
      const compressionFactor = Math.max(0.1, 200 / length);
      return Math.max(15, Math.round(length * 0.8 * compressionFactor));
    } else if (length >= 5000) {
      return 300;
    } else {
      return Math.max(15, Math.round(length * 0.8));
    }
  } else {
    if (length > 500 && length < 5000) {
      const compressionFactor = Math.max(0.1, 100 / length);
      return Math.max(10, Math.round(length * 0.8 * compressionFactor));
    } else if (length >= 5000) {
      return 300;
    } else {
      return Math.max(10, Math.round(length * 0.8));
    }
  }
}

// ---------- Header canvas (title, legends, signatories) ----------
function createHeaderCanvas(rows) {
  // create offscreen header canvas
  const h = TOP_MARGIN;
  const hc = document.createElement('canvas');
  hc.width = CANVAS_WIDTH;
  hc.height = h;
  const hctx = hc.getContext('2d');

  // background
  hctx.fillStyle = '#ffffff';
  hctx.fillRect(0, 0, hc.width, hc.height);

  // Title
  const routeName = document.getElementById('routeName').value.trim() || 'Unnamed Route';
  hctx.fillStyle = 'black';
  hctx.font = 'bold 20px Arial';
  hctx.textAlign = 'center';
  hctx.fillText(`Survey for OFC Rehab: ${routeName}`, hc.width / 2, 30);

  // total bad length
  let totalBadLength = 0;
  for (const row of rows) {
    for (const seg of row) if (seg.condition === 'bad') totalBadLength += seg.length;
  }
  hctx.font = '16px Arial';
  hctx.fillText(`Total Rehab length - ${totalBadLength} Metre`, hc.width / 2, 55);

  // legends on left
  const legendX = 20;
  const legendYStart = 30;
  const legendLineLength = 50;
  const legendGap = 15;

  hctx.lineWidth = 2;
  hctx.strokeStyle = 'black';

  // solid
  hctx.beginPath(); hctx.setLineDash([]); hctx.moveTo(legendX, legendYStart); hctx.lineTo(legendX + legendLineLength, legendYStart); hctx.stroke();
  hctx.font = '14px Arial'; hctx.textAlign = 'left';
  hctx.fillText('Existing OFC Route', legendX + legendLineLength + 10, legendYStart + 5);

  // dashed
  hctx.beginPath(); hctx.setLineDash([10, 6]); hctx.moveTo(legendX, legendYStart + legendGap); hctx.lineTo(legendX + legendLineLength, legendYStart + legendGap); hctx.stroke();
  hctx.setLineDash([]); hctx.fillText('Planned Rehab Portion', legendX + legendLineLength + 10, legendYStart + legendGap + 5);

  // bold solid for HDD
  hctx.beginPath(); hctx.lineWidth = 4; hctx.moveTo(legendX, legendYStart + 2 * legendGap); hctx.lineTo(legendX + legendLineLength, legendYStart + 2 * legendGap); hctx.stroke();
  hctx.lineWidth = 2; hctx.fillText('Planned Rehab Length(HDD)', legendX + legendLineLength + 10, legendYStart + 2 * legendGap + 5);

  // dashed thick for trenching
  hctx.beginPath(); hctx.setLineDash([15, 3]); hctx.lineWidth = 4; hctx.moveTo(legendX, legendYStart + 3 * legendGap); hctx.lineTo(legendX + legendLineLength, legendYStart + 3 * legendGap); hctx.stroke();
  hctx.setLineDash([]); hctx.lineWidth = 2; hctx.fillText('Planned Rehab Length(Trenching)', legendX + legendLineLength + 10, legendYStart + 3 * legendGap + 5);

  // Signatories bottom-right of header
  hctx.font = '12px Arial';
  hctx.textAlign = 'right';
  
  const signY = hc.height - 15;
  // hctx.fillText(officer1Input, hc.width - 20, signY);
  // hctx.fillText(officer2Input, hc.width * 3/4, signY);
  hctx.textAlign = 'center';
  //hctx.fillText(middleOfficerInput, hc.width / 2, signY);
  hctx.textAlign = 'left';
  //hctx.fillText(seniorOfficerInput, 20, signY);

  return hc;
}

// ---------- Per-row canvas creation ----------
function createRowCanvas(row, rowIndex) {
  const rc = document.createElement('canvas');
  rc.width = CANVAS_WIDTH;
  rc.height = ROW_HEIGHT;
  const rctx = rc.getContext('2d');

  // white background
  rctx.fillStyle = '#ffffff';
  rctx.fillRect(0, 0, rc.width, rc.height);

  const rowY = Math.floor(rc.height / 2); // center baseline for drawing this row
  drawRoadOnCtx(rctx, row, rowY, ROAD_GAP);
  drawOFCLinesOnCtx(rctx, row, rowY, OFC_GAP, ROAD_GAP);
  drawLowerOFCOnCtx(rctx, row, rowY, LOWER_OFC_GAP, ROAD_GAP);
  drawCumulativeLengthsOnCtx(rctx, row, rowY, OFC_GAP, ROAD_GAP,rowIndex);
  drawTechniqueMarkingsOnCtx(rctx, row, rowY, ROAD_GAP, TECHNIQUE_GAP);

  // Optionally draw row index at left
  rctx.fillStyle = 'black';
  rctx.font = 'bold 12px Arial';
  rctx.textAlign = 'left';
  rctx.fillText(``, 8, 14);

  return rc;
}

// ---------- Composite preview ----------
function compositePreviewCanvas() {
  // compute total height: header + all row canvases stacked
  let totalHeight = headerCanvas.height + rowCanvases.reduce((s, c) => s + c.height, 0) + 40;
  canvas.height = Math.max(900, totalHeight);

  // white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // draw header
  let y = 0;
  if (headerCanvas) {
    ctx.drawImage(headerCanvas, 0, y);
    y += headerCanvas.height + 10;
  }

  // draw rows
  for (const rc of rowCanvases) {
    ctx.drawImage(rc, 0, y);
    y += rc.height + 5;
  }
}

// ---------- Drawing utilities (these work on *given* ctx) ----------
function drawRoadOnCtx(rctx, row, rowY, roadGap) {
  if (!row || row.length === 0) return;

  const roadTop = rowY - roadGap / 2;
  const roadBottom = rowY + roadGap / 2;

  const roadStartX = row[0].startX;
  const roadEndX = row[row.length - 1].startX + row[row.length - 1].segWidth;
  const roadWidth = roadEndX - roadStartX;

  rctx.fillStyle = '#d9d9d9';
  rctx.fillRect(roadStartX, roadTop, roadWidth, roadGap);

  rctx.lineWidth = 1.2;
  rctx.strokeStyle = 'black';
  rctx.beginPath();
  rctx.moveTo(roadStartX, roadTop);
  rctx.lineTo(roadEndX, roadTop);
  rctx.moveTo(roadStartX, roadBottom);
  rctx.lineTo(roadEndX, roadBottom);
  rctx.stroke();
}

function drawOFCLinesOnCtx(rctx, row, rowY, ofcGap, roadGap) {
  if (!row || row.length === 0) return;
  const roadTop = rowY - roadGap / 2;
  const ofcY = roadTop - ofcGap;

  // label "OFC" left
  rctx.fillStyle = 'black';
  rctx.font = 'bold 11px Arial';
  rctx.textAlign = 'center';
  rctx.fillText('OFC', Math.max(8, row[0].startX - 40), ofcY);
  rctx.textAlign = 'left';

  for (const segment of row) {
    rctx.lineWidth = 2;
    rctx.strokeStyle = 'black';

    if (segment.condition === 'bad') {
      if (segment.hasBridge) {
        drawBridgeOnCtx(rctx, segment.startX, ofcY, segment.segWidth, segment.length);
      } else if (segment.hasCulvert) {
        drawCulvertOnCtx(rctx, segment.startX, ofcY, segment.segWidth, segment.length);
      } else {
        rctx.setLineDash([10, 6]);
        rctx.beginPath();
        rctx.moveTo(segment.startX, ofcY);
        rctx.lineTo(segment.startX + segment.segWidth, ofcY);
        rctx.stroke();
        rctx.setLineDash([]);
        if (segment.compressed) drawBreakSymbolOnCtx(rctx, segment.startX + segment.segWidth / 2, ofcY);
      }
    } else {
      rctx.setLineDash([]);
      rctx.beginPath();
      rctx.moveTo(segment.startX, ofcY);
      rctx.lineTo(segment.startX + segment.segWidth, ofcY);
      rctx.stroke();
      if (segment.compressed) {
        drawBreakSymbolOnCtx(rctx, segment.startX + segment.segWidth / 2, ofcY);
      }
    }

    // Draw landmark and coordinates parallel to each other with gap:
    // We will draw two rotated texts, offset in "x" after rotation so they are parallel.
    drawParallelLabelOnCtx(rctx, segment, ofcY - 18);
    
    // Draw length below
    rctx.fillStyle = 'black';
    rctx.font = segment.compressed ? 'bold 10px Arial' : '10px Arial';
    rctx.textAlign = 'center';
    if (segment.length) {
      rctx.fillText(`${segment.length}m`, segment.startX + segment.segWidth / 2, ofcY + 20);
    }
    rctx.textAlign = 'left';
  }
}

// Draw two parallel rotated texts: landmark name (if present) and coordinates, separated by gap
function drawParallelLabelOnCtx(rctx, segment, labelY) {
    const landmarkText = (segment.isLandmark && segment.landmarkName)
        ? String(segment.landmarkName).trim()
        : null;

    const coordText = segment.coordinatesAvailable
        ? `(${Number(segment.startLat).toFixed(4)}, ${Number(segment.startLong).toFixed(4)})`
        : null;

    if (!landmarkText && !coordText) return;

    // Vertical placement anchor
    const anchorX = Math.max(10, segment.startX +0);

    // Define spacing
    const font1 = "bold 11px Arial";
    const font2 = "10px Arial";
    const lineGap = 14;     // GAP between landmark and coordinates (THIS FIXES OVERLAP)
    const maxWidth = 300;   // truncate if needed

    // Helper: truncate long text
    function fitText(text, font) {
        rctx.font = font;
        if (rctx.measureText(text).width <= maxWidth) return text;

        let t = text;
        while (rctx.measureText(t + "…").width > maxWidth && t.length > 3) {
            t = t.slice(0, -1);
        }
        return t + "…";
    }

    //const LM = landmarkText ? fitText(landmarkText, font1) : null;
    //const CO = coordText ? fitText(coordText, font2) : null;
    const LM = landmarkText
    const CO = coordText; 

    rctx.save();
    rctx.translate(anchorX, labelY);
    rctx.rotate(-Math.PI / 2);
    rctx.fillStyle = "black";
    rctx.textAlign = "left";

    let yOffset = 0;

    // Draw landmark at top
    if (LM) {
        rctx.font = font1;
        rctx.fillText(LM, 0, yOffset);
        yOffset += lineGap;      // *** THIS PROVIDES CLEAR SEPARATION ***
    }

    // Draw coordinates below landmark
    if (CO) {
        rctx.font = font2;
        rctx.fillText(CO, 0, yOffset);
    }

    rctx.restore();
}



// Break symbol cleaned up
function drawBreakSymbolOnCtx(rctx, centerX, y) {
  rctx.save();
  rctx.strokeStyle = 'black';
  rctx.lineWidth = 2;

  const slashW = 5;
  const slashH = 12;

  // First slash
  rctx.beginPath();
  rctx.moveTo(centerX - slashW - 3, y - slashH / 2);
  rctx.lineTo(centerX - 3, y + slashH / 2);
  rctx.stroke();

  // Second slash
  rctx.beginPath();
  rctx.moveTo(centerX + 3, y - slashH / 2);
  rctx.lineTo(centerX + slashW + 8, y + slashH / 2);
  rctx.stroke();

  // small erasure (destination-out) to indicate a gap in the OFC line
  rctx.globalCompositeOperation = 'destination-out';
  rctx.beginPath();
  rctx.moveTo(centerX - 1, y - 2);
  rctx.lineTo(centerX + 7, y + 2);
  rctx.lineWidth = 3;
  rctx.stroke();
  rctx.globalCompositeOperation = 'source-over';
  rctx.restore();
}

// Bridge drawing (kept similar to yours)
function drawBridgeOnCtx(rctx, startX, y, width, length) {
  const centerX = startX + width / 2;
  const bridgeHeight = 15;
  const archCount = Math.max(3, Math.floor(width / 20));

  rctx.setLineDash([]);
  rctx.lineWidth = 2;
  rctx.strokeStyle = 'black';
  rctx.beginPath();
  rctx.moveTo(startX, y);
  rctx.lineTo(startX + width, y);
  rctx.stroke();

  rctx.strokeStyle = 'black';
  rctx.lineWidth = 1.5;

  const archSpacing = width / (archCount + 1);
  for (let i = 1; i <= archCount; i++) {
    const archX = startX + i * archSpacing;
    rctx.beginPath();
    rctx.moveTo(archX - archSpacing / 2, y);
    rctx.quadraticCurveTo(archX, y - bridgeHeight, archX + archSpacing / 2, y);
    rctx.stroke();

    rctx.beginPath();
    rctx.moveTo(archX - archSpacing / 3, y);
    rctx.lineTo(archX - archSpacing / 3, y + 3);
    rctx.moveTo(archX + archSpacing / 3, y);
    rctx.lineTo(archX + archSpacing / 3, y + 3);
    rctx.stroke();
  }

  // label
  rctx.save();
  rctx.fillStyle = 'black';
  rctx.font = 'bold 11px Arial';
  rctx.textAlign = 'center';
  rctx.translate(centerX, y - bridgeHeight - 25);
  rctx.rotate(-Math.PI / 2);
  rctx.fillText(`Bridge ${length}m`, 0, 0);
  rctx.restore();
}

// Culvert drawing
function drawCulvertOnCtx(rctx, startX, y, width, length) {
  const centerX = startX + width / 2;
  const culvertHeight = 12;
  const pipeCount = Math.max(2, Math.floor(width / 25));

  rctx.setLineDash([]);
  rctx.lineWidth = 2;
  rctx.strokeStyle = 'black';
  rctx.beginPath();
  rctx.moveTo(startX, y);
  rctx.lineTo(startX + width, y);
  rctx.stroke();

  rctx.strokeStyle = 'black';
  rctx.lineWidth = 1.5;

  const pipeSpacing = width / (pipeCount + 1);
  for (let i = 1; i <= pipeCount; i++) {
    const pipeX = startX + i * pipeSpacing;
    rctx.beginPath();
    rctx.arc(pipeX, y - culvertHeight / 2, culvertHeight / 2, 0, Math.PI * 2);
    rctx.stroke();

    rctx.beginPath();
    rctx.moveTo(pipeX - culvertHeight / 2, y - culvertHeight / 2);
    rctx.lineTo(pipeX - culvertHeight / 2 - 2, y - culvertHeight / 2);
    rctx.moveTo(pipeX + culvertHeight / 2, y - culvertHeight / 2);
    rctx.lineTo(pipeX + culvertHeight / 2 + 2, y - culvertHeight / 2);
    rctx.stroke();
  }

  rctx.save();
  rctx.fillStyle = 'black';
  rctx.font = 'bold 11px Arial';
  rctx.textAlign = 'center';
  rctx.translate(centerX, y - culvertHeight - 35);
  rctx.rotate(-Math.PI / 2);
  rctx.fillText(`Culvert ${length}m`, 0, 0);
  rctx.restore();
}

// Lower OFC (rehab) rendering
function drawLowerOFCOnCtx(rctx, row, rowY, lowerOFCGap, roadGap) {
  const roadBottom = rowY + roadGap / 2;
  const lowerY = roadBottom + lowerOFCGap;
  rctx.fillStyle = 'black';
  rctx.font = 'bold 11px Arial';
  rctx.textAlign = 'center';
  if (row && row.length) rctx.fillText('REHAB', Math.max(8, row[0].startX - 30), lowerY);
  rctx.textAlign = 'left';

  for (const seg of row) {
    if (seg.condition === 'bad') {
      rctx.lineWidth = 4;
      rctx.strokeStyle = 'black';
      if (seg.technique === 'trenching') {
        rctx.setLineDash([15, 3]);
      } else {
        rctx.setLineDash([]);
      }
      rctx.beginPath();
      rctx.moveTo(seg.startX, lowerY);
      rctx.lineTo(seg.startX + seg.segWidth, lowerY);
      rctx.stroke();
      rctx.setLineDash([]);
    }
  }
}

function drawCumulativeLengthsOnCtx(rctx, row, rowY, ofcGap, roadGap,rowIndex) {
  const roadTop = rowY - roadGap / 2;
  const ofcY = roadTop - ofcGap;

  rctx.fillStyle = 'black';
  rctx.font = 'bold 11px Arial';
  rctx.textAlign = 'center';
  
  if (rowIndex === 0 && row.length > 0) {
    const startX = row[0].startX;

    // Draw the vertical tick for 0 (same style as other ticks)
    rctx.strokeStyle = 'black';
    rctx.lineWidth = 1;
    rctx.beginPath();
    rctx.moveTo(startX, ofcY - 5);
    rctx.lineTo(startX, ofcY + 5);
    rctx.stroke();

    // Draw rotated "0 M" label at the same relative position as other cumulative labels
    rctx.save();
    rctx.translate(startX, ofcY + 35);
    rctx.rotate(-Math.PI / 2);
    rctx.fillText(`0 M`, 0, 0);
    rctx.restore();
  }

  for (const seg of row) {
    const endX = seg.startX + seg.segWidth;
    rctx.save();
    rctx.translate(endX, ofcY + 35);
    rctx.rotate(-Math.PI / 2);
    if (seg.length) rctx.fillText(`${seg.cumulativeLength} M`, 0, 0);
    rctx.restore();

    if (seg.length) {
      rctx.strokeStyle = 'black';
      rctx.lineWidth = 1;
      rctx.beginPath();
      rctx.moveTo(endX, ofcY - 5);
      rctx.lineTo(endX, ofcY + 5);
      rctx.stroke();
    }
  }
  rctx.textAlign = 'left';
}

function drawTechniqueMarkingsOnCtx(rctx, row, rowY, roadGap, techniqueGap) {
  const roadBottom = rowY + roadGap / 2;
  const techniqueY = roadBottom + techniqueGap;

  const techniqueGroups = [];
  let currentGroup = null;

  for (let i = 0; i < row.length; i++) {
    const segment = row[i];
    if (segment.condition === 'bad' && segment.technique) {
      if (currentGroup && currentGroup.technique === segment.technique) {
        currentGroup.endX = segment.startX + segment.segWidth;
        currentGroup.totalLength += segment.length;
        currentGroup.segments.push(segment);
      } else {
        if (currentGroup) techniqueGroups.push(currentGroup);
        currentGroup = {
          technique: segment.technique,
          startX: segment.startX,
          endX: segment.startX + segment.segWidth,
          totalLength: segment.length,
          segments: [segment]
        };
      }
    } else {
      if (currentGroup) {
        techniqueGroups.push(currentGroup);
        currentGroup = null;
      }
    }
  }
  if (currentGroup) techniqueGroups.push(currentGroup);

  for (const group of techniqueGroups) {
    const centerX = (group.startX + group.endX) / 2;
    rctx.fillStyle = 'black';
    rctx.font = 'bold 11px Arial';
    rctx.textAlign = 'center';
    rctx.fillText(`${group.technique.toUpperCase()} (${group.totalLength}m)`, centerX, techniqueY);
  }
}

// ---------- Clear ----------
function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  document.getElementById('inputData').value = '';
  canvas.height = 900;
  hasDrawnContent = false;
  document.getElementById('routeName').value = '';
  document.getElementById('seniorOfficer').value = '';
  document.getElementById('middleOfficer').value = '';
  document.getElementById('officer2').value = '';
  document.getElementById('officer1').value = '';
  rowCanvases = [];
  headerCanvas = null;
}

// ---------- PDF export (multi-page) ----------
async function exportToPDF() {
  if (!hasDrawnContent) {
    alert('Please draw a diagram first before exporting to PDF.');
    return;
  }

  const { jsPDF } = window.jspdf;

  // A4 landscape
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidthMM = pdf.internal.pageSize.getWidth();
  const pageHeightMM = pdf.internal.pageSize.getHeight();
  const marginMM = 10;
  const usableW = pageWidthMM - 2 * marginMM;
  const usableH = pageHeightMM - 2 * marginMM;

  let yPosMM = marginMM;

  // Helper to draw an image canvas onto PDF with scaled dimensions
  const addCanvasToPdfAt = (canvasEl, xMM, yMM, maxWmm, maxHmm) => {
    const imgData = canvasEl.toDataURL('image/png');

    // compute scale to fit width
    const widthPx = canvasEl.width;
    const heightPx = canvasEl.height;
    const pxToMm = PX_TO_MM;

    // scale so that width becomes <= maxWmm
    const desiredWmm = Math.min(maxWmm, widthPx * pxToMm);
    const scale = desiredWmm / (widthPx * pxToMm);
    const drawW = desiredWmm;
    const drawH = heightPx * pxToMm * scale;

    // add image
    pdf.addImage(imgData, 'PNG', xMM, yMM, drawW, drawH);

    return drawH; // height used in mm
  };

  // First, put header on first page (if present)
  if (headerCanvas) {
    // If header too tall for first page (rare), scale to fit usableH
    const headerHeightMM = headerCanvas.height * PX_TO_MM;
    const headerWidthMM = headerCanvas.width * PX_TO_MM;
    const headerScale = Math.min(1, usableW / headerWidthMM, usableH / headerHeightMM);
    const dispHeaderW = headerCanvas.width * PX_TO_MM * headerScale;
    const dispHeaderH = headerCanvas.height * PX_TO_MM * headerScale;

    pdf.addImage(headerCanvas.toDataURL('image/png'), 'PNG', marginMM, yPosMM, dispHeaderW, dispHeaderH);
    yPosMM += dispHeaderH + 4;
  }

  // iterate rows; place as many rows on a page as fit; every row will be placed whole
  for (let i = 0; i < rowCanvases.length; i++) {
    const rc = rowCanvases[i];
    // compute target height in mm if width scaled to usableW
    const rcWidthMM = rc.width * PX_TO_MM;
    const scale = Math.min(1, usableW / rcWidthMM);
    const rcHeightMM = rc.height * PX_TO_MM * scale;

    // if doesn't fit remaining vertical space, start new page
    if (yPosMM + rcHeightMM > pageHeightMM - marginMM) {
      pdf.addPage();
      yPosMM = marginMM;
    }

    addCanvasToPdfAt(rc, marginMM, yPosMM, usableW, usableH);
    yPosMM += rcHeightMM + 4; // small gutter
  }

 // -----------------------------------------
// SIGNATORIES ON LAST PAGE
// -----------------------------------------
pdf.setFont("Arial", "normal");
pdf.setFontSize(12);

const signY = pdf.internal.pageSize.getHeight() - 40; // 40px from bottom
const centerX = pdf.internal.pageSize.getWidth() / 2;

// Read officer names LIVE
const seniorOfficer = document.getElementById('seniorOfficer').value.trim();
const middleOfficer = document.getElementById('middleOfficer').value.trim();
const officer2 = document.getElementById('officer2').value.trim();
const officer1 = document.getElementById('officer1').value.trim();

// Layout positions
//pdf.text("____________________", 60, signY - 12);
if (seniorOfficer) pdf.text(seniorOfficer, 30, signY);

//pdf.text("____________________", centerX - 80, signY - 12);
if (middleOfficer) pdf.text(middleOfficer, centerX - 40, signY);

//pdf.text("____________________", centerX + 80, signY - 12);
if (officer2) pdf.text(officer2, centerX + 40, signY);

//pdf.text("____________________", pdf.internal.pageSize.getWidth() - 160, signY - 12);
if (officer1) pdf.text(officer1, pdf.internal.pageSize.getWidth() - 60, signY);

  const routeName = document.getElementById('routeName').value.trim() || 'OFC_Route_Diagram';
  pdf.save(`${routeName}_Rehab_RouteDiagram.pdf`);
}
