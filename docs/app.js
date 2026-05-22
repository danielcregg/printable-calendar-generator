const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const FULL_WEEKDAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const CUSTOM_DATE_RGB = [26, 86, 219];
const CUSTOM_DATE_CSS = `rgb(${CUSTOM_DATE_RGB.join(", ")})`;

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

// Fills the teaching-week schedule fields with the standard ATU dates
// computed from the calendar year.
function autoFillTeachingDates() {
  const year = Number(document.getElementById("year").value) || new Date().getFullYear();
  const octBreak = lastMonday(year, 9);
  const easterBreak = addDays(easterSunday(year), -6);
  document.getElementById("s1Start").value = isoDate(addDays(octBreak, -42));
  document.getElementById("s1Break").value = isoDate(octBreak);
  document.getElementById("s2Start").value = isoDate(addDays(firstMonday(year, 0), 14));
  document.getElementById("s2Break").value = isoDate(easterBreak);
}

// Maps each teaching week's Monday (ISO date) to its label, W1..W13 per
// semester, read from the schedule fields, skipping the break weeks.
function teachingWeekMap() {
  const map = new Map();
  const toMonday = (iso) => {
    const d = new Date(iso + "T00:00:00");
    return isoDate(addDays(d, -mondayIndex(d)));
  };
  const fill = (startISO, breakISOs) => {
    if (!startISO) return;
    const startMonday = new Date(toMonday(startISO) + "T00:00:00");
    const breaks = new Set(breakISOs.filter(Boolean).map(toMonday));
    let count = 1;
    for (let i = 0; count <= 13 && i < 30; i++) {
      const key = isoDate(addDays(startMonday, i * 7));
      if (breaks.has(key)) continue;
      map.set(key, "W" + count);
      count++;
    }
  };
  const s2Break = document.getElementById("s2Break").value;
  const s2Break2 = s2Break ? isoDate(addDays(new Date(toMonday(s2Break) + "T00:00:00"), 7)) : "";
  fill(document.getElementById("s1Start").value, [document.getElementById("s1Break").value]);
  fill(document.getElementById("s2Start").value, [s2Break, s2Break2]);
  return map;
}

function updateTeachingPanel() {
  document.getElementById("teachingPanel").hidden = !document.getElementById("teachingWeeks").checked;
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
  const entryFor = (date) => {
    if (!labels.has(date)) labels.set(date, { holiday: null, custom: null });
    return labels.get(date);
  };
  const country = document.getElementById("country").value;
  const showHolidays = document.getElementById("holidayLabels").checked;
  if (country === "IE" && showHolidays) {
    for (const [d, label] of irelandHolidays(year)) entryFor(d).holiday = label;
  }
  for (const [d, label] of parseCustomDates(document.getElementById("customDates").value)) {
    entryFor(d).custom = label;
  }
  return labels;
}

// Day-cell offsets that carry both a holiday and a custom label (stacked).
function stackedOffsets(year, monthIndex, labels) {
  const startOffset = mondayIndex(new Date(year, monthIndex, 1));
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const offsets = new Set();
  for (let day = 1; day <= days; day++) {
    const entry = labels.get(isoDate(new Date(year, monthIndex, day)));
    if (entry && entry.holiday && entry.custom) offsets.add((day - 1) + startOffset);
  }
  return offsets;
}

function monthRows(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const days = new Date(year, monthIndex + 1, 0).getDate();
  return mondayIndex(first) + days <= 35 ? 5 : 6;
}

function layout(scale = 1) {
  const w = 297 * scale;
  const h = 210 * scale;
  const margin = 10 * scale;
  const headerH = 22 * scale;
  const gridX = margin;
  const gridY = margin + headerH;
  const gridW = w - 2 * margin;
  const gridH = h - 2 * margin - headerH;
  return { w, h, margin, headerH, gridX, gridY, gridW, gridH };
}

function pt(points, scale = 1) {
  // Canvas uses px, while PDF fonts use points. Convert pt -> mm -> scaled px.
  return points * (25.4 / 72) * scale;
}

function drawCalendar(ctx, year, monthIndex, labels, scale = 1, options = {}) {
  const { shadeWeekends, zebraWeeks, zebraColumns, guideLines, highlightDate, fullDayNames, teachingWeeks } = options;
  const base = layout(scale);
  const { w, h, margin, headerH, gridY, gridH } = base;
  const gutter = teachingWeeks ? 13 * scale : 0;
  const gridX = base.gridX + gutter;
  const gridW = base.gridW - gutter;
  const rows = monthRows(year, monthIndex);
  const cols = 7;
  const colW = gridW / cols;
  const rowH = gridH / rows;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "black";
  ctx.font = `bold ${pt(40, scale)}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`${MONTH_NAMES[monthIndex]} ${year}`, w / 2, margin + 8 * scale);

  if (zebraWeeks) {
    ctx.fillStyle = "#f4f4f4";
    for (let r = 1; r < rows; r += 2) ctx.fillRect(gridX, gridY + r * rowH, gridW, rowH);
  }

  if (zebraColumns) {
    ctx.fillStyle = "#f4f4f4";
    for (let c = 1; c < cols; c += 2) ctx.fillRect(gridX + c * colW, gridY, colW, gridH);
  }

  if (shadeWeekends) {
    ctx.fillStyle = "#ebebeb";
    for (const col of [5, 6]) ctx.fillRect(gridX + col * colW, gridY, colW, gridH);
  }

  ctx.fillStyle = "black";
  ctx.textAlign = "center";
  const weekdayLabels = fullDayNames ? FULL_WEEKDAYS : WEEKDAYS;
  let weekdayPt = 20;
  ctx.font = `bold ${pt(weekdayPt, scale)}px Arial`;
  let widestWeekday = 0;
  for (const label of weekdayLabels) widestWeekday = Math.max(widestWeekday, ctx.measureText(label).width);
  const weekdayMaxW = colW - 4 * scale;
  if (widestWeekday > weekdayMaxW) {
    weekdayPt *= weekdayMaxW / widestWeekday;
    ctx.font = `bold ${pt(weekdayPt, scale)}px Arial`;
  }
  for (let i = 0; i < 7; i++) {
    ctx.fillText(weekdayLabels[i], gridX + i * colW + colW / 2, margin + headerH - 1.5 * scale);
  }

  if (guideLines) {
    const skip = stackedOffsets(year, monthIndex, labels);
    ctx.save();
    ctx.strokeStyle = "#bfbfbf";
    ctx.lineWidth = 0.6 * scale;
    ctx.setLineDash([2 * scale, 3 * scale]);
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        if (skip.has(r * cols + col)) continue;
        const x0 = gridX + col * colW + 3 * scale;
        const x1 = gridX + (col + 1) * colW - 3 * scale;
        const yt = gridY + r * rowH;
        const yb = yt + rowH;
        const yStart = yt + 10 * scale;
        const yEnd = yb - 2 * scale;
        const spacing = (yEnd - yStart) / 4;
        for (let k = 1; k <= 3; k++) {
          const y = yStart + k * spacing;
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

  if (highlightDate) {
    const [hYear, hMonth, hDay] = highlightDate.split("-").map(Number);
    if (hYear === year && hMonth - 1 === monthIndex) {
      const offset = (hDay - 1) + mondayIndex(new Date(year, monthIndex, 1));
      const hx = gridX + (offset % cols) * colW;
      const hy = gridY + Math.floor(offset / cols) * rowH;
      ctx.fillStyle = "#fff1c2";
      ctx.fillRect(hx, hy, colW, rowH);
      ctx.strokeStyle = "#e0a800";
      ctx.lineWidth = 2.4 * scale;
      ctx.strokeRect(hx, hy, colW, rowH);
    }
  }

  const first = new Date(year, monthIndex, 1);
  const days = new Date(year, monthIndex + 1, 0).getDate();
  ctx.textAlign = "left";
  for (let day = 1; day <= days; day++) {
    const d = new Date(year, monthIndex, day);
    const offset = (day - 1) + mondayIndex(first);
    const r = Math.floor(offset / cols);
    const col = offset % cols;
    const y = gridY + r * rowH;
    const x = gridX + col * colW;
    ctx.fillStyle = "black";
    ctx.font = `bold ${pt(22, scale)}px Arial`;
    ctx.fillText(String(day), x + 3.5 * scale, y + 9 * scale);

    const entry = labels.get(isoDate(d));
    if (entry) {
      ctx.font = `italic bold ${pt(9, scale)}px Arial`;
      const bottomY = y + rowH - 3.5 * scale;
      if (entry.holiday && entry.custom) {
        ctx.fillStyle = "black";
        ctx.fillText(entry.holiday.slice(0, 32), x + 3 * scale, bottomY);
        ctx.fillStyle = CUSTOM_DATE_CSS;
        ctx.fillText(entry.custom.slice(0, 32), x + 3 * scale, bottomY - 4 * scale);
      } else if (entry.custom) {
        ctx.fillStyle = CUSTOM_DATE_CSS;
        ctx.fillText(entry.custom.slice(0, 32), x + 3 * scale, bottomY);
      } else {
        ctx.fillStyle = "black";
        ctx.fillText(entry.holiday.slice(0, 32), x + 3 * scale, bottomY);
      }
    }
  }

  if (teachingWeeks) {
    const monthFirst = new Date(year, monthIndex, 1);
    const row0Monday = addDays(monthFirst, -mondayIndex(monthFirst));
    ctx.fillStyle = "black";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${pt(13, scale)}px Arial`;
    for (let r = 0; r < rows; r++) {
      const wLabel = teachingWeeks.get(isoDate(addDays(row0Monday, r * 7)));
      if (wLabel) ctx.fillText(wLabel, base.gridX + gutter / 2, gridY + r * rowH + rowH / 2);
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
  drawCalendar(ctx, year, month, labels, scale, {
    shadeWeekends: document.getElementById("shadeWeekends").checked,
    zebraWeeks: document.getElementById("zebraWeeks").checked,
    zebraColumns: document.getElementById("zebraColumns").checked,
    guideLines: document.getElementById("guideLines").checked,
    fullDayNames: document.getElementById("fullDayNames").checked,
    teachingWeeks: document.getElementById("teachingWeeks").checked ? teachingWeekMap() : null,
  });
  updateMonthNav();
}

// Updates the preview's month-stepper label, and disables the arrows in
// full-year mode (there is no single month to step from).
function updateMonthNav() {
  const monthValue = document.getElementById("month").value;
  const year = Number(document.getElementById("year").value);
  const isFullYear = monthValue === "all";
  document.getElementById("monthNavLabel").textContent =
    isFullYear ? `Full year ${year}` : `${MONTH_NAMES[Number(monthValue)]} ${year}`;
  document.getElementById("prevMonthBtn").disabled = isFullYear;
  document.getElementById("nextMonthBtn").disabled = isFullYear;
}

// Steps the Month selector by delta months, rolling the Year over at the
// December/January boundary, then re-renders.
function stepMonth(delta) {
  const monthSelect = document.getElementById("month");
  if (monthSelect.value === "all") return;
  const yearInput = document.getElementById("year");
  let month = Number(monthSelect.value) + delta;
  let year = Number(yearInput.value);
  if (month > 11) { month = 0; year += 1; }
  else if (month < 0) { month = 11; year -= 1; }
  monthSelect.value = String(month);
  yearInput.value = String(year);
  renderPreview();
}

function handlePreviewClick(event) {
  const canvas = document.getElementById("preview");
  const rect = canvas.getBoundingClientRect();
  const scale = canvas.width / 297;
  const cx = (event.clientX - rect.left) * (canvas.width / rect.width);
  const cy = (event.clientY - rect.top) * (canvas.height / rect.height);
  const { gridX, gridY, gridW, gridH } = layout(scale);
  if (cx < gridX || cx > gridX + gridW || cy < gridY || cy > gridY + gridH) return;

  const year = Number(document.getElementById("year").value);
  const monthValue = document.getElementById("month").value;
  const monthIndex = monthValue === "all" ? 0 : Number(monthValue);
  const rows = monthRows(year, monthIndex);
  const col = Math.floor((cx - gridX) / (gridW / 7));
  const row = Math.floor((cy - gridY) / (gridH / rows));
  if (col < 0 || col > 6 || row < 0 || row >= rows) return;

  const first = new Date(year, monthIndex, 1);
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const day = row * 7 + col - mondayIndex(first) + 1;
  if (day < 1 || day > days) return;

  const date = isoDate(new Date(year, monthIndex, day));
  const label = (window.prompt(`Add a custom date for ${date}:`) || "").trim();
  if (!label) return;

  const box = document.getElementById("customDates");
  const current = box.value.replace(/\s+$/, "");
  box.value = (current ? current + "\n" : "") + `${date} | ${label}`;
  renderPreview();
}

function drawPdfMonth(doc, year, monthIndex, labels) {
  const teachingWeeks = document.getElementById("teachingWeeks").checked ? teachingWeekMap() : null;
  const base = layout(1);
  const { w, h, margin, headerH, gridY, gridH } = base;
  const gutter = teachingWeeks ? 13 : 0;
  const gridX = base.gridX + gutter;
  const gridW = base.gridW - gutter;
  const rows = monthRows(year, monthIndex);
  const colW = gridW / 7;
  const rowH = gridH / rows;
  const shadeWeekends = document.getElementById("shadeWeekends").checked;
  const zebraWeeks = document.getElementById("zebraWeeks").checked;
  const zebraColumns = document.getElementById("zebraColumns").checked;
  const guideLines = document.getElementById("guideLines").checked;
  const fullDayNames = document.getElementById("fullDayNames").checked;

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, w, h, "F");
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(40);
  doc.text(`${MONTH_NAMES[monthIndex]} ${year}`, w / 2, margin + 8, { align: "center" });

  if (zebraWeeks) {
    doc.setFillColor(244, 244, 244);
    for (let r = 1; r < rows; r += 2) doc.rect(gridX, gridY + r * rowH, gridW, rowH, "F");
  }

  if (zebraColumns) {
    doc.setFillColor(244, 244, 244);
    for (let c = 1; c < 7; c += 2) doc.rect(gridX + c * colW, gridY, colW, gridH, "F");
  }

  if (shadeWeekends) {
    doc.setFillColor(235, 235, 235);
    for (const col of [5, 6]) doc.rect(gridX + col * colW, gridY, colW, gridH, "F");
  }

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  const weekdayLabels = fullDayNames ? FULL_WEEKDAYS : WEEKDAYS;
  let weekdaySize = 20;
  doc.setFontSize(weekdaySize);
  let widestWeekday = 0;
  for (const label of weekdayLabels) widestWeekday = Math.max(widestWeekday, doc.getTextWidth(label));
  const weekdayMaxW = colW - 4;
  if (widestWeekday > weekdayMaxW) {
    weekdaySize *= weekdayMaxW / widestWeekday;
    doc.setFontSize(weekdaySize);
  }
  for (let i = 0; i < 7; i++) doc.text(weekdayLabels[i], gridX + i * colW + colW / 2, margin + headerH - 1.5, { align: "center" });

  if (guideLines) {
    const skip = stackedOffsets(year, monthIndex, labels);
    doc.setDrawColor(191, 191, 191);
    doc.setLineWidth(0.6);
    doc.setLineDashPattern([2, 3], 0);
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < 7; col++) {
        if (skip.has(r * 7 + col)) continue;
        const x0 = gridX + col * colW + 3;
        const x1 = gridX + (col + 1) * colW - 3;
        const yt = gridY + r * rowH;
        const yb = yt + rowH;
        const spacing = ((yb - 2) - (yt + 10)) / 4;
        for (let k = 1; k <= 3; k++) doc.line(x0, yt + 10 + k * spacing, x1, yt + 10 + k * spacing);
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
    const y = gridY + r * rowH;
    const x = gridX + col * colW;
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text(String(day), x + 3.5, y + 9);

    const entry = labels.get(isoDate(d));
    if (entry) {
      doc.setFont("helvetica", "bolditalic");
      doc.setFontSize(9);
      const bottomY = y + rowH - 3.5;
      if (entry.holiday && entry.custom) {
        doc.setTextColor(0, 0, 0);
        doc.text(entry.holiday.slice(0, 32), x + 3, bottomY);
        doc.setTextColor(...CUSTOM_DATE_RGB);
        doc.text(entry.custom.slice(0, 32), x + 3, bottomY - 4);
      } else if (entry.custom) {
        doc.setTextColor(...CUSTOM_DATE_RGB);
        doc.text(entry.custom.slice(0, 32), x + 3, bottomY);
      } else {
        doc.setTextColor(0, 0, 0);
        doc.text(entry.holiday.slice(0, 32), x + 3, bottomY);
      }
    }
  }

  if (teachingWeeks) {
    const monthFirst = new Date(year, monthIndex, 1);
    const row0Monday = addDays(monthFirst, -mondayIndex(monthFirst));
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    for (let r = 0; r < rows; r++) {
      const wLabel = teachingWeeks.get(isoDate(addDays(row0Monday, r * 7)));
      if (wLabel) doc.text(wLabel, base.gridX + gutter / 2, gridY + r * rowH + rowH / 2, { align: "center", baseline: "middle" });
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

const STORAGE_KEY = "printableCalendars";

function readSavedCalendars() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function writeSavedCalendars(all) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

function currentSettings() {
  return {
    year: document.getElementById("year").value,
    month: document.getElementById("month").value,
    country: document.getElementById("country").value,
    shadeWeekends: document.getElementById("shadeWeekends").checked,
    zebraWeeks: document.getElementById("zebraWeeks").checked,
    zebraColumns: document.getElementById("zebraColumns").checked,
    guideLines: document.getElementById("guideLines").checked,
    holidayLabels: document.getElementById("holidayLabels").checked,
    fullDayNames: document.getElementById("fullDayNames").checked,
    teachingWeeks: document.getElementById("teachingWeeks").checked,
    s1Start: document.getElementById("s1Start").value,
    s1Break: document.getElementById("s1Break").value,
    s2Start: document.getElementById("s2Start").value,
    s2Break: document.getElementById("s2Break").value,
    customDates: document.getElementById("customDates").value,
  };
}

function applySettings(settings) {
  document.getElementById("year").value = settings.year;
  document.getElementById("month").value = settings.month;
  document.getElementById("country").value = settings.country;
  document.getElementById("shadeWeekends").checked = settings.shadeWeekends;
  document.getElementById("zebraWeeks").checked = settings.zebraWeeks;
  document.getElementById("zebraColumns").checked = settings.zebraColumns;
  document.getElementById("guideLines").checked = settings.guideLines;
  document.getElementById("holidayLabels").checked = settings.holidayLabels;
  document.getElementById("fullDayNames").checked = settings.fullDayNames;
  document.getElementById("teachingWeeks").checked = settings.teachingWeeks;
  if (settings.s1Start) {
    document.getElementById("s1Start").value = settings.s1Start;
    document.getElementById("s1Break").value = settings.s1Break;
    document.getElementById("s2Start").value = settings.s2Start;
    document.getElementById("s2Break").value = settings.s2Break;
  } else {
    autoFillTeachingDates();
  }
  document.getElementById("customDates").value = settings.customDates;
  updateTeachingPanel();
  renderPreview();
}

function refreshSavedList(selectedName) {
  const select = document.getElementById("savedCalendars");
  const names = Object.keys(readSavedCalendars()).sort((a, b) => a.localeCompare(b));
  select.innerHTML = "";
  for (const name of names) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  }
  if (names.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No saved calendars yet";
    select.appendChild(option);
  }
  if (selectedName && names.includes(selectedName)) select.value = selectedName;
  const empty = names.length === 0;
  select.disabled = empty;
  document.getElementById("loadBtn").disabled = empty;
  document.getElementById("deleteBtn").disabled = empty;
}

function saveCalendar() {
  const nameInput = document.getElementById("calendarName");
  const name = nameInput.value.trim();
  if (!name) {
    window.alert("Enter a name for this calendar.");
    nameInput.focus();
    return;
  }
  const all = readSavedCalendars();
  if (all[name] && !window.confirm(`Replace the saved calendar "${name}"?`)) return;
  all[name] = currentSettings();
  if (!writeSavedCalendars(all)) {
    window.alert("Could not save — this browser's storage is full or unavailable.");
    return;
  }
  refreshSavedList(name);
}

function loadCalendar() {
  const name = document.getElementById("savedCalendars").value;
  if (!name) return;
  const settings = readSavedCalendars()[name];
  if (!settings) return;
  applySettings(settings);
  document.getElementById("calendarName").value = name;
}

function deleteCalendar() {
  const name = document.getElementById("savedCalendars").value;
  if (!name) return;
  if (!window.confirm(`Delete the saved calendar "${name}"?`)) return;
  const all = readSavedCalendars();
  delete all[name];
  writeSavedCalendars(all);
  refreshSavedList();
}

const GROUPS_KEY = "printableCustomDateGroups";

function readGroups() {
  try {
    return JSON.parse(localStorage.getItem(GROUPS_KEY)) || {};
  } catch {
    return {};
  }
}

function writeGroups(all) {
  try {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

function refreshGroupList(selectedName) {
  const select = document.getElementById("customGroups");
  const names = Object.keys(readGroups()).sort((a, b) => a.localeCompare(b));
  select.innerHTML = "";
  for (const name of names) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  }
  if (names.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No saved groups yet";
    select.appendChild(option);
  }
  if (selectedName && names.includes(selectedName)) select.value = selectedName;
  const empty = names.length === 0;
  select.disabled = empty;
  document.getElementById("addGroupBtn").disabled = empty;
  document.getElementById("deleteGroupBtn").disabled = empty;
}

function saveGroup() {
  const nameInput = document.getElementById("groupName");
  const name = nameInput.value.trim();
  if (!name) {
    window.alert("Enter a name for this date group.");
    nameInput.focus();
    return;
  }
  const text = document.getElementById("customDates").value.trim();
  if (!text) {
    window.alert("There are no custom dates to save as a group.");
    return;
  }
  const all = readGroups();
  if (all[name] && !window.confirm(`Replace the date group "${name}"?`)) return;
  all[name] = text;
  if (!writeGroups(all)) {
    window.alert("Could not save — this browser's storage is full or unavailable.");
    return;
  }
  refreshGroupList(name);
}

function addGroup() {
  const name = document.getElementById("customGroups").value;
  if (!name) return;
  const text = readGroups()[name];
  if (!text) return;
  const box = document.getElementById("customDates");
  const current = box.value.replace(/\s+$/, "");
  box.value = (current ? current + "\n" : "") + text;
  renderPreview();
}

function deleteGroup() {
  const name = document.getElementById("customGroups").value;
  if (!name) return;
  if (!window.confirm(`Delete the date group "${name}"?`)) return;
  const all = readGroups();
  delete all[name];
  writeGroups(all);
  refreshGroupList();
}

let icsEvents = [];

function parseIcs(text) {
  // Normalise newlines, then unfold continuation lines (leading space/tab).
  const lines = text.replace(/\r\n|\r/g, "\n").replace(/\n[ \t]/g, "").split("\n");
  const events = [];
  let current = null;
  for (const line of lines) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const name = line.slice(0, colon).split(";")[0].trim().toUpperCase();
    const value = line.slice(colon + 1);
    if (name === "BEGIN" && value === "VEVENT") {
      current = {};
      continue;
    }
    if (name === "END" && value === "VEVENT") {
      if (current && current.date) {
        events.push({ date: current.date, label: current.summary || "Imported date", yearly: !!current.yearly });
      }
      current = null;
      continue;
    }
    if (!current) continue;
    if (name === "DTSTART") {
      const digits = value.replace(/[^0-9]/g, "");
      if (digits.length >= 8) {
        current.date = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
      }
    } else if (name === "SUMMARY") {
      current.summary = value
        .replace(/\\n/gi, " ")
        .replace(/\\,/g, ",")
        .replace(/\\;/g, ";")
        .replace(/\\\\/g, "\\")
        .trim();
    } else if (name === "RRULE" && /FREQ=YEARLY/i.test(value)) {
      current.yearly = true;
    }
  }
  return events;
}

function loadIcsFile(file) {
  file.text().then((text) => showIcsResults(parseIcs(text)));
}

function showIcsResults(events) {
  const calYear = Number(document.getElementById("year").value) || new Date().getFullYear();
  icsEvents = events
    .map((e) => ({
      date: e.yearly ? `${calYear}-${e.date.slice(5)}` : e.date,
      label: e.label,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const results = document.getElementById("icsResults");
  const actions = document.getElementById("icsActions");
  results.innerHTML = "";

  if (icsEvents.length === 0) {
    results.textContent = "No dated events were found in that file.";
    results.hidden = false;
    actions.hidden = true;
    return;
  }

  icsEvents.forEach((event, index) => {
    const row = document.createElement("label");
    row.className = "ics-item";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = true;
    checkbox.dataset.index = String(index);
    const text = document.createElement("span");
    text.textContent = `${event.date}  —  ${event.label}`;
    row.append(checkbox, text);
    results.appendChild(row);
  });
  results.hidden = false;
  actions.hidden = false;
}

function addIcsSelected() {
  const lines = [];
  for (const checkbox of document.querySelectorAll("#icsResults input:checked")) {
    const event = icsEvents[Number(checkbox.dataset.index)];
    if (event) lines.push(`${event.date} | ${event.label}`);
  }
  if (lines.length === 0) {
    window.alert("Tick at least one date to add.");
    return;
  }
  const box = document.getElementById("customDates");
  const current = box.value.replace(/\s+$/, "");
  box.value = (current ? current + "\n" : "") + lines.join("\n");
  renderPreview();
  clearIcs();
}

function clearIcs() {
  icsEvents = [];
  const results = document.getElementById("icsResults");
  results.innerHTML = "";
  results.hidden = true;
  document.getElementById("icsActions").hidden = true;
  document.getElementById("icsFile").value = "";
}

// --- Setup drawer (the mobile slide-in menu) ---
function openDrawer() {
  document.getElementById("drawer").classList.add("open");
  document.getElementById("scrim").classList.add("show");
  document.getElementById("menuBtn").setAttribute("aria-expanded", "true");
  document.body.classList.add("drawer-open");
  document.getElementById("drawerCloseBtn").focus();
}

function closeDrawer() {
  document.getElementById("drawer").classList.remove("open");
  document.getElementById("scrim").classList.remove("show");
  document.getElementById("menuBtn").setAttribute("aria-expanded", "false");
  document.body.classList.remove("drawer-open");
}

function toggleDrawer() {
  if (document.getElementById("drawer").classList.contains("open")) closeDrawer();
  else openDrawer();
}

window.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("previewBtn")) return;
  document.getElementById("previewBtn").addEventListener("click", renderPreview);
  document.getElementById("downloadBtn").addEventListener("click", downloadPdf);
  document.getElementById("preview").addEventListener("click", handlePreviewClick);
  document.getElementById("prevMonthBtn").addEventListener("click", () => stepMonth(-1));
  document.getElementById("nextMonthBtn").addEventListener("click", () => stepMonth(1));
  document.getElementById("menuBtn").addEventListener("click", toggleDrawer);
  document.getElementById("drawerCloseBtn").addEventListener("click", () => {
    closeDrawer();
    document.getElementById("menuBtn").focus();
  });
  document.getElementById("scrim").addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDrawer();
  });
  document.getElementById("saveBtn").addEventListener("click", saveCalendar);
  document.getElementById("loadBtn").addEventListener("click", loadCalendar);
  document.getElementById("deleteBtn").addEventListener("click", deleteCalendar);
  document.getElementById("saveGroupBtn").addEventListener("click", saveGroup);
  document.getElementById("addGroupBtn").addEventListener("click", addGroup);
  document.getElementById("deleteGroupBtn").addEventListener("click", deleteGroup);
  const icsDrop = document.getElementById("icsDrop");
  icsDrop.addEventListener("dragover", (event) => {
    event.preventDefault();
    icsDrop.classList.add("dragover");
  });
  icsDrop.addEventListener("dragleave", () => icsDrop.classList.remove("dragover"));
  icsDrop.addEventListener("drop", (event) => {
    event.preventDefault();
    icsDrop.classList.remove("dragover");
    if (event.dataTransfer.files[0]) loadIcsFile(event.dataTransfer.files[0]);
  });
  document.getElementById("icsFile").addEventListener("change", (event) => {
    if (event.target.files[0]) loadIcsFile(event.target.files[0]);
  });
  document.getElementById("icsAddBtn").addEventListener("click", addIcsSelected);
  document.getElementById("icsClearBtn").addEventListener("click", clearIcs);
  document.getElementById("autoFillWeeksBtn").addEventListener("click", () => {
    autoFillTeachingDates();
    renderPreview();
  });
  document.getElementById("teachingWeeks").addEventListener("change", updateTeachingPanel);
  document.getElementById("year").addEventListener("change", autoFillTeachingDates);
  for (const id of ["year", "month", "country", "shadeWeekends", "zebraWeeks", "zebraColumns", "guideLines", "holidayLabels", "fullDayNames", "teachingWeeks", "s1Start", "s1Break", "s2Start", "s2Break", "customDates"]) {
    document.getElementById(id).addEventListener("input", renderPreview);
    document.getElementById(id).addEventListener("change", renderPreview);
  }
  refreshSavedList();
  refreshGroupList();
  autoFillTeachingDates();
  updateTeachingPanel();
  renderPreview();
});
