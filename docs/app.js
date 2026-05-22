const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function mondayIndex(date) {
  return (date.getDay() + 6) % 7;
}

function firstMonday(year, monthIndex) {
  const d = new Date(year, monthIndex, 1);
  d.setDate(d.getDate() + ((7 - mondayIndex(d)) % 7));
  return d;
}

function lastMonday(year, monthIndex) {
  const d = new Date(year, monthIndex + 1, 0);
  d.setDate(d.getDate() - mondayIndex(d));
  return d;
}

function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function stBrigidsDay(year) {
  const feb1 = new Date(year, 1, 1);
  if (feb1.getDay() === 5) return feb1;
  return firstMonday(year, 1);
}

function irelandHolidays(year) {
  const easter = easterSunday(year);
  const labels = new Map();
  labels.set(`${year}-01-01`, "New Year's Day");
  labels.set(isoDate(stBrigidsDay(year)), "St Brigid's Day");
  labels.set(`${year}-03-17`, "St Patrick's Day");
  labels.set(isoDate(addDays(easter, -2)), "Good Friday");
  labels.set(isoDate(easter), "Easter Sunday");
  labels.set(isoDate(addDays(easter, 1)), "Easter Monday");
  labels.set(isoDate(firstMonday(year, 4)), "May Bank Holiday");
  labels.set(isoDate(firstMonday(year, 5)), "June Bank Holiday");
  labels.set(isoDate(firstMonday(year, 7)), "August Bank Holiday");
  labels.set(isoDate(lastMonday(year, 9)), "October Bank Holiday");
  labels.set(`${year}-12-25`, "Christmas Day");
  labels.set(`${year}-12-26`, "St Stephen's Day");

  const christmas = new Date(year, 11, 25);
  const stephens = new Date(year, 11, 26);
  if (christmas.getDay() === 6) {
    labels.set(`${year}-12-27`, "Christmas observed");
    labels.set(`${year}-12-28`, "St Stephen's observed");
  } else if (christmas.getDay() === 0) {
    labels.set(`${year}-12-27`, "Christmas observed");
  } else if (stephens.getDay() === 6 || stephens.getDay() === 0) {
    labels.set(`${year}-12-28`, "St Stephen's observed");
  }
  return labels;
}

function parseCustomDates(text) {
  const labels = new Map();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const [datePart, ...rest] = line.split("|");
    const label = rest.join("|").trim();
    const date = datePart.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && label) {
      labels.set(date, labels.has(date) ? `${labels.get(date)} / ${label}` : label);
    }
  }
  return labels;
}

function buildLabels(year) {
  const labels = new Map();
  const country = document.getElementById("country").value;
  const showHolidays = document.getElementById("holidayLabels").checked;
  if (country === "IE" && showHolidays) {
    for (const [d, label] of irelandHolidays(year)) labels.set(d, label);
  }
  for (const [d, label] of parseCustomDates(document.getElementById("customDates").value)) {
    labels.set(d, labels.has(d) ? `${labels.get(d)} / ${label}` : label);
  }
  return labels;
}

function monthRows(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const days = new Date(year, monthIndex + 1, 0).getDate();
  return mondayIndex(first) + days <= 35 ? 5 : 6;
}

function drawCalendar(ctx, year, monthIndex, labels, scale = 1) {
  const w = 297 * scale;
  const h = 210 * scale;
  const margin = 10 * scale;
  const headerH = 22 * scale;
  const gridX = margin;
  const gridY = margin;
  const gridW = w - 2 * margin;
  const gridH = h - 2 * margin - headerH;
  const gridTop = gridY + gridH;
  const rows = monthRows(year, monthIndex);
  const cols = 7;
  const colW = gridW / cols;
  const rowH = gridH / rows;
  const shadeWeekends = document.getElementById("shadeWeekends").checked;
  const guideLines = document.getElementById("guideLines").checked;

  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "black";
  ctx.font = `bold ${40 * scale}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`${MONTH_NAMES[monthIndex]} ${year}`, w / 2, h - margin - 8 * scale);

  if (shadeWeekends) {
    ctx.fillStyle = "#ebebeb";
    for (const col of [5, 6]) ctx.fillRect(gridX + col * colW, gridY, colW, gridH);
  }

  ctx.fillStyle = "black";
  ctx.font = `bold ${20 * scale}px Arial`;
  ctx.textAlign = "center";
  for (let i = 0; i < 7; i++) {
    ctx.fillText(WEEKDAYS[i], gridX + i * colW + colW / 2, gridTop + 7 * scale);
  }

  if (guideLines) {
    ctx.save();
    ctx.strokeStyle = "#bfbfbf";
    ctx.lineWidth = 0.6 * scale;
    ctx.setLineDash([2 * scale, 3 * scale]);
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const x0 = gridX + col * colW + 3 * scale;
        const x1 = gridX + (col + 1) * colW - 3 * scale;
        const yb = gridY + (rows - 1 - r) * rowH;
        const yt = yb + rowH;
        const yStart = yt - 10 * scale;
        const yEnd = yb + 2 * scale;
        const spacing = (yStart - yEnd) / 4;
        for (let k = 1; k <= 3; k++) {
          const y = yStart - k * spacing;
          ctx.beginPath();
          ctx.moveTo(x0, y);
          ctx.lineTo(x1, y);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  ctx.strokeStyle = "black";
  ctx.lineWidth = 1.6 * scale;
  ctx.strokeRect(gridX, gridY, gridW, gridH);
  for (let i = 1; i < cols; i++) {
    const x = gridX + i * colW;
    ctx.beginPath(); ctx.moveTo(x, gridY); ctx.lineTo(x, gridY + gridH); ctx.stroke();
  }
  for (let j = 1; j < rows; j++) {
    const y = gridY + j * rowH;
    ctx.beginPath(); ctx.moveTo(gridX, y); ctx.lineTo(gridX + gridW, y); ctx.stroke();
  }

  const first = new Date(year, monthIndex, 1);
  const days = new Date(year, monthIndex + 1, 0).getDate();
  ctx.fillStyle = "black";
  for (let day = 1; day <= days; day++) {
    const d = new Date(year, monthIndex, day);
    const offset = (day - 1) + mondayIndex(first);
    const r = Math.floor(offset / cols);
    const col = offset % cols;
    const y = gridY + (rows - 1 - r) * rowH;
    const x = gridX + col * colW;
    ctx.font = `bold ${22 * scale}px Arial`;
    ctx.textAlign = "left";
    ctx.fillText(String(day), x + 3.5 * scale, y + rowH - 9 * scale);
    const label = labels.get(isoDate(d));
    if (label) {
      ctx.font = `italic bold ${9 * scale}px Arial`;
      ctx.fillText(label.slice(0, 32), x + 3 * scale, y + 3.5 * scale);
    }
  }
}

function renderPreview() {
  const canvas = document.getElementById("preview");
  const ctx = canvas.getContext("2d");
  const scale = canvas.width / 297;
  const year = Number(document.getElementById("year").value);
  const monthValue = document.getElementById("month").value;
  const month = monthValue === "all" ? 0 : Number(monthValue);
  const labels = buildLabels(year);
  drawCalendar(ctx, year, month, labels, scale);
}

function drawPdfMonth(doc, year, monthIndex, labels) {
  const scale = 1;
  const w = 297;
  const h = 210;
  const margin = 10;
  const headerH = 22;
  const gridX = margin;
  const gridY = margin;
  const gridW = w - 2 * margin;
  const gridH = h - 2 * margin - headerH;
  const gridTop = gridY + gridH;
  const rows = monthRows(year, monthIndex);
  const colW = gridW / 7;
  const rowH = gridH / rows;
  const shadeWeekends = document.getElementById("shadeWeekends").checked;
  const guideLines = document.getElementById("guideLines").checked;

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, w, h, "F");
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(40);
  doc.text(`${MONTH_NAMES[monthIndex]} ${year}`, w / 2, h - margin - 8, { align: "center" });

  if (shadeWeekends) {
    doc.setFillColor(235, 235, 235);
    for (const col of [5, 6]) doc.rect(gridX + col * colW, gridY, colW, gridH, "F");
  }

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  for (let i = 0; i < 7; i++) doc.text(WEEKDAYS[i], gridX + i * colW + colW / 2, gridTop + 7, { align: "center" });

  if (guideLines) {
    doc.setDrawColor(191, 191, 191);
    doc.setLineWidth(0.6);
    doc.setLineDashPattern([2, 3], 0);
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < 7; col++) {
        const x0 = gridX + col * colW + 3;
        const x1 = gridX + (col + 1) * colW - 3;
        const yb = gridY + (rows - 1 - r) * rowH;
        const yt = yb + rowH;
        const spacing = ((yt - 10) - (yb + 2)) / 4;
        for (let k = 1; k <= 3; k++) doc.line(x0, yt - 10 - k * spacing, x1, yt - 10 - k * spacing);
      }
    }
    doc.setLineDashPattern([], 0);
  }

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(1.6);
  doc.rect(gridX, gridY, gridW, gridH);
  for (let i = 1; i < 7; i++) doc.line(gridX + i * colW, gridY, gridX + i * colW, gridY + gridH);
  for (let j = 1; j < rows; j++) doc.line(gridX, gridY + j * rowH, gridX + gridW, gridY + j * rowH);

  const first = new Date(year, monthIndex, 1);
  const days = new Date(year, monthIndex + 1, 0).getDate();
  for (let day = 1; day <= days; day++) {
    const d = new Date(year, monthIndex, day);
    const offset = (day - 1) + mondayIndex(first);
    const r = Math.floor(offset / 7);
    const col = offset % 7;
    const y = gridY + (rows - 1 - r) * rowH;
    const x = gridX + col * colW;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text(String(day), x + 3.5, y + rowH - 9);
    const label = labels.get(isoDate(d));
    if (label) {
      doc.setFont("helvetica", "bolditalic");
      doc.setFontSize(9);
      doc.text(label.slice(0, 32), x + 3, y + 3.5);
    }
  }
}

function downloadPdf() {
  const { jsPDF } = window.jspdf;
  const year = Number(document.getElementById("year").value);
  const monthValue = document.getElementById("month").value;
  const labels = buildLabels(year);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const months = monthValue === "all" ? [...Array(12).keys()] : [Number(monthValue)];
  months.forEach((m, i) => {
    if (i > 0) doc.addPage("a4", "landscape");
    drawPdfMonth(doc, year, m, labels);
  });
  const name = monthValue === "all" ? `calendar_${year}.pdf` : `${MONTH_NAMES[Number(monthValue)].toLowerCase()}_${year}.pdf`;
  doc.save(name);
}

window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("previewBtn").addEventListener("click", renderPreview);
  document.getElementById("downloadBtn").addEventListener("click", downloadPdf);
  for (const id of ["year", "month", "country", "shadeWeekends", "guideLines", "holidayLabels", "customDates"]) {
    document.getElementById(id).addEventListener("input", renderPreview);
    document.getElementById(id).addEventListener("change", renderPreview);
  }
  renderPreview();
});
