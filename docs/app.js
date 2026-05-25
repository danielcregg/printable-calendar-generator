// Printable Calendar Generator — single-file engine for the static web app.
//
// The file is organised top-down into focused sections, each marked by a
// section banner. The two rendering paths (canvas preview and jsPDF export)
// duplicate work on purpose, so they always agree pixel-for-pixel; see
// AGENTS.md for the dual-render-path rationale.

// ============================================================================
// Constants
// ============================================================================

// Calendar-grid display names by language. UI controls and the Today
// page stay in English; only month and weekday names on the rendered
// calendar switch when the user picks a different language.
const MONTH_NAMES = {
  en: ["January", "February", "March", "April", "May", "June",
       "July", "August", "September", "October", "November", "December"],
  ga: ["Eanáir", "Feabhra", "Márta", "Aibreán", "Bealtaine", "Meitheamh",
       "Iúil", "Lúnasa", "Meán Fómhair", "Deireadh Fómhair", "Samhain", "Nollaig"],
};
const WEEKDAYS = {
  en: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
  ga: ["LUA", "MÁI", "CÉA", "DÉA", "AOI", "SAT", "DOM"],
};
const FULL_WEEKDAYS = {
  en: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"],
  ga: ["LUAN", "MÁIRT", "CÉADAOIN", "DÉARDAOIN", "AOINE", "SATHARN", "DOMHNACH"],
};
const FULL_YEAR_LABELS = { en: "Full year", ga: "An bhliain ar fad" };

// Year-picker range: from the current year through 2099. MIN_YEAR is
// captured at page load and is shared by the dropdown, the month stepper
// and the saved-calendar loader.
const MIN_YEAR = new Date().getFullYear();
const MAX_YEAR = 2099;

// Opt-in colour presets. The defaults (grey shading, black labels) keep the
// printed calendar black and white.
const SHADE_THEMES = {
  grey:  { weekend: [241, 241, 241], zebra: [247, 247, 247] },
  blue:  { weekend: [229, 238, 248], zebra: [241, 245, 251] },
  green: { weekend: [232, 241, 232], zebra: [243, 247, 243] },
  warm:  { weekend: [249, 240, 228], zebra: [251, 246, 238] },
};
const LABEL_COLOURS = {
  black: [0, 0, 0],
  blue:  [26, 86, 219],
  green: [34, 113, 58],
};

// localStorage keys for the two stores below.
const STORAGE_KEY = "printableCalendars";
const GROUPS_KEY = "printableCustomDateGroups";

// ============================================================================
// Small utilities
// ============================================================================

function rgbCss(rgb) {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

// ============================================================================
// Date math (Monday-first weeks, Easter, ISO formatting)
// ============================================================================

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

// Anonymous Gregorian algorithm — returns the Date of Easter Sunday for `year`.
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

// ============================================================================
// Irish public/bank holidays
// ============================================================================

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

// ============================================================================
// Custom dates: parsing and recurrence expansion
// ============================================================================

// Parses a recurrence rule into { unit, n, count, until } or null if it
// cannot be parsed. Accepts the shortcuts daily/weekly/monthly/yearly and
// Maps used by the "nth weekday of month" parser. Weekday indices match
// mondayIndex: Mon=0 … Sun=6.
const RULE_ORDINALS = {
  first: 1, "1st": 1, second: 2, "2nd": 2, third: 3, "3rd": 3, fourth: 4, "4th": 4, last: -1,
};
const RULE_WEEKDAYS = {
  mon: 0, monday: 0,
  tue: 1, tues: 1, tuesday: 1,
  wed: 2, wednesday: 2,
  thu: 3, thur: 3, thurs: 3, thursday: 3,
  fri: 4, friday: 4,
  sat: 5, saturday: 5,
  sun: 6, sunday: 6,
};

// "every N <day|week|month|year>" or "<first|2nd|last> <weekday> of [every [N]]
// month[s]", optionally followed by "x N" (occurrence count) and/or
// "until YYYY-MM-DD" (the two suffixes may appear in either order).
// Unparseable rules return null and the caller falls back to a one-off date.
function parseRule(text) {
  const r = text.toLowerCase().trim();
  if (!r) return null;
  let body = r, count = null, until = null;
  let progress = true;
  while (progress) {
    progress = false;
    const um = body.match(/\s+until\s+(\d{4}-\d{2}-\d{2})$/);
    if (um) { until = um[1]; body = body.slice(0, um.index); progress = true; continue; }
    const cm = body.match(/\s+x\s*(\d+)$/);
    if (cm) { count = Number(cm[1]); body = body.slice(0, cm.index); progress = true; }
  }
  body = body.trim();
  const aliases = { daily: "day", weekly: "week", monthly: "month", yearly: "year" };
  if (aliases[body]) return { unit: aliases[body], n: 1, count, until };
  const interval = body.match(/^every\s+(?:(\d+)\s+)?(day|days|week|weeks|month|months|year|years)$/);
  if (interval) {
    const n = interval[1] ? Number(interval[1]) : 1;
    const unit = interval[2].replace(/s$/, "");
    return { unit, n, count, until };
  }
  // "first tuesday of month", "last friday of every month", "2nd monday of every 3 months"
  const nth = body.match(/^(\S+)\s+(\S+)\s+of\s+(?:every\s+)?(?:(\d+)\s+)?months?$/);
  if (nth) {
    const ordinal = RULE_ORDINALS[nth[1]];
    const weekday = RULE_WEEKDAYS[nth[2]];
    if (ordinal !== undefined && weekday !== undefined) {
      const n = nth[3] ? Number(nth[3]) : 1;
      return { unit: "nthWeekdayOfMonth", ordinal, weekday, n, count, until };
    }
  }
  return null;
}

// Returns the Date for the ordinal-th occurrence of `targetWeekday` (0=Mon
// … 6=Sun) in the given month, or null when no such date exists (e.g. a
// fifth Tuesday in a month that doesn't have one). `ordinal` is 1..4 for
// first/second/third/fourth, or -1 for the last occurrence.
function nthWeekdayOfMonth(year, monthIndex, ordinal, targetWeekday) {
  if (ordinal === -1) {
    const last = new Date(year, monthIndex + 1, 0);
    const diff = (mondayIndex(last) - targetWeekday + 7) % 7;
    return new Date(year, monthIndex, last.getDate() - diff);
  }
  const first = new Date(year, monthIndex, 1);
  const dayOfFirstMatch = ((targetWeekday - mondayIndex(first) + 7) % 7) + 1;
  const day = dayOfFirstMatch + (ordinal - 1) * 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  return day > daysInMonth ? null : new Date(year, monthIndex, day);
}

// Yields ISO dates of a recurrence starting at startISO. Bounded by the
// rule's count, its until date, and the start of year + 2 (the calendar
// only ever renders one year at a time). A hard cap of 5000 occurrences
// guards against pathological inputs.
function* expandRule(startISO, rule, year) {
  if (!rule) { yield startISO; return; }
  const start = new Date(startISO + "T00:00:00");
  const untilDate = rule.until ? new Date(rule.until + "T00:00:00") : null;
  const stopAt = new Date(year + 2, 0, 1);
  const maxCount = Math.min(rule.count != null ? rule.count : Infinity, 5000);

  // "Nth weekday of month" rules ignore the literal start date and yield
  // the computed Nth weekday of each month from the start's month onward.
  if (rule.unit === "nthWeekdayOfMonth") {
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    let i = 0;
    while (i < maxCount) {
      if (cursor >= stopAt) break;
      const target = nthWeekdayOfMonth(cursor.getFullYear(), cursor.getMonth(), rule.ordinal, rule.weekday);
      if (target) {
        if (untilDate && target > untilDate) break;
        yield isoDate(target);
        i++;
      }
      cursor.setMonth(cursor.getMonth() + rule.n);
    }
    return;
  }

  const current = new Date(start);
  let i = 0;
  while (i < maxCount) {
    if (untilDate && current > untilDate) break;
    if (current >= stopAt) break;
    yield isoDate(current);
    i++;
    if (rule.unit === "day") current.setDate(current.getDate() + rule.n);
    else if (rule.unit === "week") current.setDate(current.getDate() + rule.n * 7);
    else if (rule.unit === "month") current.setMonth(current.getMonth() + rule.n);
    else if (rule.unit === "year") current.setFullYear(current.getFullYear() + rule.n);
  }
}

// Parses the Custom dates textarea into a Map of ISO date -> array of labels.
// Lines look like "YYYY-MM-DD | Label [| rule]". Recurring rules are expanded
// into every occurrence that falls inside the rendered year (± a small
// buffer). Lines starting with # are treated as comments.
function parseCustomDates(text, year) {
  const labels = new Map();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const parts = line.split("|");
    const date = (parts[0] || "").trim();
    const label = (parts[1] || "").trim();
    const ruleText = parts.slice(2).join("|").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !label) continue;
    const rule = ruleText ? parseRule(ruleText) : null;
    for (const occ of expandRule(date, rule, year)) {
      if (!labels.has(occ)) labels.set(occ, []);
      labels.get(occ).push(label);
    }
  }
  return labels;
}

// ============================================================================
// Day-cell labels: build per-date entries and order them for stacking
// ============================================================================

// Merges the holiday Map and custom-dates Map into a single Map of ISO date ->
// { holiday: string|null, custom: string[] }. Each day cell consults this for
// what to draw at the bottom of its box.
function buildLabels(year) {
  const labels = new Map();
  const entryFor = (date) => {
    if (!labels.has(date)) labels.set(date, { holiday: null, custom: [] });
    return labels.get(date);
  };
  if (document.getElementById("country").value === "IE") {
    for (const [d, label] of irelandHolidays(year)) entryFor(d).holiday = label;
  }
  for (const [d, list] of parseCustomDates(document.getElementById("customDates").value, year)) {
    entryFor(d).custom = list;
  }
  return labels;
}

// Orders a day's labels into stacked lines, top to bottom: custom dates
// first (italic, optionally coloured), then the holiday (bold, black) at the
// bottom. Returns an array of { text, custom: boolean }.
function labelStack(entry) {
  if (!entry) return [];
  const stack = entry.custom.map((text) => ({ text, custom: true }));
  if (entry.holiday) stack.push({ text: entry.holiday, custom: false });
  return stack;
}

// ============================================================================
// Teaching weeks (W1..W13 per semester, with break weeks skipped)
// ============================================================================

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

// True if any row of (year, monthIndex) carries a teaching-week label. Used
// to skip the 13 mm left gutter on months that have nothing to show.
function monthHasTeachingWeeks(teachingWeeks, year, monthIndex, rows) {
  if (!teachingWeeks) return false;
  const monthFirst = new Date(year, monthIndex, 1);
  const row0Monday = addDays(monthFirst, -mondayIndex(monthFirst));
  for (let r = 0; r < rows; r++) {
    if (teachingWeeks.get(isoDate(addDays(row0Monday, r * 7)))) return true;
  }
  return false;
}

function updateTeachingPanel() {
  document.getElementById("teachingPanel").hidden = !document.getElementById("teachingWeeks").checked;
}

// Rewrites the visible text of the Month dropdown options to match the
// current Language selection. Option values stay numeric so saved
// calendars and the renderer don't care about the UI language.
function applyLanguage() {
  const lang = document.getElementById("language").value || "en";
  const months = MONTH_NAMES[lang] || MONTH_NAMES.en;
  const fullYear = FULL_YEAR_LABELS[lang] || FULL_YEAR_LABELS.en;
  for (const opt of document.getElementById("month").options) {
    if (opt.value === "all") opt.textContent = fullYear;
    else opt.textContent = months[Number(opt.value)];
  }
}

// ============================================================================
// Layout geometry — A4 landscape, row count, guide-line plan
// ============================================================================

function monthRows(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const days = new Date(year, monthIndex + 1, 0).getDate();
  return mondayIndex(first) + days <= 35 ? 5 : 6;
}

function layout(scale = 1) {
  const w = 297 * scale;
  const h = 210 * scale;
  const margin = 7 * scale;
  const headerH = 22 * scale;
  const gridX = margin;
  const gridY = margin + headerH;
  const gridW = w - 2 * margin;
  const gridH = h - 2 * margin - headerH;
  return { w, h, margin, headerH, gridX, gridY, gridW, gridH };
}

// Canvas uses px, while PDF fonts use points. Convert pt -> mm -> scaled px.
function pt(points, scale = 1) {
  return points * (25.4 / 72) * scale;
}

// 3 guide lines in 5-row months, 2 (respaced) in 6-row months so the
// per-line writing gap stays roughly the same.
function baseGuideLines(rows) {
  return rows === 6 ? 2 : 3;
}

// Row-by-row runs of empty day cells: at most one leading run on row 0 and
// one trailing run from the last-day row onward (which may span more than
// one row). Empties on a single row are returned as one run.
function computeEmptyRuns(leadingCount, trailingStart, rows) {
  const runs = [];
  if (leadingCount > 0) runs.push({ row: 0, colStart: 0, colEnd: leadingCount - 1, type: "leading" });
  const lastDayOffset = trailingStart - 1;
  const lastDayRow = Math.floor(lastDayOffset / 7);
  const lastDayCol = lastDayOffset % 7;
  if (lastDayCol < 6) runs.push({ row: lastDayRow, colStart: lastDayCol + 1, colEnd: 6, type: "trailing" });
  for (let r = lastDayRow + 1; r < rows; r++) runs.push({ row: r, colStart: 0, colEnd: 6, type: "trailing" });
  return runs;
}

// ============================================================================
// Canvas renderer (on-screen preview)
// ============================================================================

function drawCalendar(ctx, year, monthIndex, labels, scale = 1, options = {}) {
  const { shadeWeekends, zebraWeeks, zebraColumns, guideLines, fullDayNames, teachingWeeks, notesArea } = options;
  const shade = SHADE_THEMES[options.shadeColour] || SHADE_THEMES.grey;
  const customCss = rgbCss(LABEL_COLOURS[options.customColour] || LABEL_COLOURS.black);
  const lang = options.lang || "en";
  const monthNames = MONTH_NAMES[lang] || MONTH_NAMES.en;
  const weekdayNames = WEEKDAYS[lang] || WEEKDAYS.en;
  const fullWeekdayNames = FULL_WEEKDAYS[lang] || FULL_WEEKDAYS.en;
  const base = layout(scale);
  const { w, h, margin, headerH, gridY, gridH } = base;
  const rows = monthRows(year, monthIndex);
  const hasWeeksHere = monthHasTeachingWeeks(teachingWeeks, year, monthIndex, rows);
  const gutter = hasWeeksHere ? 13 * scale : 0;
  const gridX = base.gridX + gutter;
  const gridW = base.gridW - gutter;
  const cols = 7;
  const colW = gridW / cols;
  const rowH = gridH / rows;
  const leadingCount = mondayIndex(new Date(year, monthIndex, 1));
  const trailingStart = leadingCount + new Date(year, monthIndex + 1, 0).getDate();
  const emptyRuns = computeEmptyRuns(leadingCount, trailingStart, rows);
  const emptyCells = new Set();
  for (const run of emptyRuns) for (let c = run.colStart; c <= run.colEnd; c++) emptyCells.add(run.row * cols + c);

  // Background.
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, w, h);

  // Title — "Month" in bold, " Year" regular, centred as a single line.
  // Title — month centred and bold; year smaller and right-aligned on the
  // same baseline (the month is the hero of the page; the year is metadata).
  ctx.fillStyle = "black";
  ctx.textBaseline = "alphabetic";
  const titleY = margin + 8 * scale;
  ctx.font = `bold ${pt(40, scale)}px Arial`;
  ctx.textAlign = "center";
  ctx.fillText(monthNames[monthIndex], w / 2, titleY);
  ctx.font = `${pt(22, scale)}px Arial`;
  ctx.textAlign = "right";
  ctx.fillText(String(year), w - margin, titleY);

  // Shading.
  if (zebraWeeks) {
    ctx.fillStyle = rgbCss(shade.zebra);
    for (let r = 1; r < rows; r += 2) ctx.fillRect(gridX, gridY + r * rowH, gridW, rowH);
  }
  if (zebraColumns) {
    ctx.fillStyle = rgbCss(shade.zebra);
    for (let c = 1; c < cols; c += 2) ctx.fillRect(gridX + c * colW, gridY, colW, gridH);
  }
  if (shadeWeekends) {
    ctx.fillStyle = rgbCss(shade.weekend);
    for (const col of [5, 6]) ctx.fillRect(gridX + col * colW, gridY, colW, gridH);
  }
  // In Notes-area mode, paint the merged blocks white so any shading
  // underneath does not bleed into the writing area.
  if (notesArea) {
    ctx.fillStyle = "white";
    for (const run of emptyRuns) {
      ctx.fillRect(gridX + run.colStart * colW, gridY + run.row * rowH, (run.colEnd - run.colStart + 1) * colW, rowH);
    }
  }

  // Weekday header (auto-shrinks if the full names don't fit).
  ctx.fillStyle = "black";
  ctx.textAlign = "center";
  const weekdayLabels = fullDayNames ? fullWeekdayNames : weekdayNames;
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

  // Writing guide lines (per-cell, plus full-width per-run in Notes mode).
  // The dashes are equispaced between the day-number baseline (yt + 9) and
  // the bottom cell gridline, creating `lines + 1` natural slots that
  // labels drop into without ever displacing a dash.
  if (guideLines) {
    const lines = baseGuideLines(rows);
    ctx.save();
    ctx.strokeStyle = "#cccccc";
    ctx.lineWidth = 0.6 * scale;
    ctx.setLineDash([2 * scale, 3 * scale]);
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        if (notesArea && emptyCells.has(r * cols + col)) continue;
        const x0 = gridX + col * colW + 3 * scale;
        const x1 = gridX + (col + 1) * colW - 3 * scale;
        const yt = gridY + r * rowH;
        const yb = yt + rowH;
        const yStart = yt + 9 * scale;
        const spacing = (yb - yStart) / (lines + 1);
        for (let k = 1; k <= lines; k++) {
          const y = yStart + k * spacing;
          ctx.beginPath();
          ctx.moveTo(x0, y);
          ctx.lineTo(x1, y);
          ctx.stroke();
        }
      }
    }
    if (notesArea) {
      for (const run of emptyRuns) {
        const x0 = gridX + run.colStart * colW + 3 * scale;
        const x1 = gridX + (run.colEnd + 1) * colW - 3 * scale;
        const yt = gridY + run.row * rowH;
        const yb = yt + rowH;
        const yStart = yt + 9 * scale;
        const yEnd = yb;
        const spacing = (yEnd - yStart) / (lines + 1);
        for (let k = 1; k <= lines; k++) {
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

  // Grid borders. In Notes mode the internal vertical between two empty
  // cells in the same row is skipped, merging them into one visual block.
  ctx.strokeStyle = "#222222";
  ctx.lineWidth = 0.7 * scale;
  ctx.strokeRect(gridX, gridY, gridW, gridH);
  if (notesArea) {
    for (let r = 0; r < rows; r++) {
      const yt = gridY + r * rowH;
      const yb = yt + rowH;
      for (let i = 1; i < cols; i++) {
        if (emptyCells.has(r * cols + (i - 1)) && emptyCells.has(r * cols + i)) continue;
        const x = gridX + i * colW;
        ctx.beginPath(); ctx.moveTo(x, yt); ctx.lineTo(x, yb); ctx.stroke();
      }
    }
  } else {
    for (let i = 1; i < cols; i++) {
      const x = gridX + i * colW;
      ctx.beginPath(); ctx.moveTo(x, gridY); ctx.lineTo(x, gridY + gridH); ctx.stroke();
    }
  }
  for (let j = 1; j < rows; j++) {
    const y = gridY + j * rowH;
    ctx.beginPath(); ctx.moveTo(gridX, y); ctx.lineTo(gridX + gridW, y); ctx.stroke();
  }

  // Day numbers + bottom-left labels.
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
    ctx.fillText(String(day), x + 3 * scale, y + 9 * scale);

    // Labels drop into the natural cell slots created by the equispaced
    // guide lines (lines + 1 slots), stacking from the bottom up. Dashes
    // are never removed; if there are more labels than slots, the excess
    // is silently truncated keeping the holiday (always the last item).
    // Each label is uniformly sized (11 pt by default) and its baseline
    // sits just above the slot's bottom line so the text reads as
    // "written on the line". Any label too wide for the column is shrunk
    // to fit, mirroring the weekday-headers pattern.
    const stack = labelStack(labels.get(isoDate(d)));
    if (stack.length) {
      const slots = baseGuideLines(rows) + 1;
      const visible = stack.slice(-slots);
      const slotSpacing = (rowH - 9 * scale) / slots;
      const labelMaxW = colW - 6 * scale;
      visible.forEach((item, i) => {
        const text = item.text.slice(0, 32);
        const weight = item.custom ? "italic bold" : "bold";
        let labelPt = 12;
        ctx.font = `${weight} ${pt(labelPt, scale)}px Arial`;
        const textW = ctx.measureText(text).width;
        if (textW > labelMaxW) {
          labelPt *= labelMaxW / textW;
          ctx.font = `${weight} ${pt(labelPt, scale)}px Arial`;
        }
        ctx.fillStyle = item.custom ? customCss : "black";
        const slotIndex = slots - (visible.length - 1 - i);  // 1..slots from top
        const slotBottom = y + 9 * scale + slotIndex * slotSpacing;
        // Baseline sits 2 mm above the slot's bottom line so descenders
        // (g, p, y, …) keep a visible gap above the line below.
        ctx.fillText(text, x + 3 * scale, slotBottom - 2 * scale);
      });
    }
  }

  // Leading/trailing cells: either a "Notes" tag (Notes-area mode) or the
  // adjacent month's day numbers with a faint Jul/Sep abbreviation.
  if (notesArea && emptyRuns.length) {
    ctx.fillStyle = "#999999";
    ctx.font = `italic ${pt(10, scale)}px Arial`;
    ctx.textAlign = "left";
    for (const run of emptyRuns) {
      const cx = gridX + run.colStart * colW + 3.5 * scale;
      const cy = gridY + run.row * rowH + 6 * scale;
      ctx.fillText("Notes", cx, cy);
    }
  }
  if (!notesArea && emptyRuns.length) {
    const prev = new Date(year, monthIndex, 0);
    const prevLastDay = prev.getDate();
    const prevMonthName = monthNames[prev.getMonth()];
    const nextMonthName = monthNames[(monthIndex + 1) % 12];
    ctx.fillStyle = "#a8a8a8";
    ctx.font = `bold ${pt(22, scale)}px Arial`;
    ctx.textAlign = "left";
    for (const run of emptyRuns) {
      for (let c = run.colStart; c <= run.colEnd; c++) {
        const offset = run.row * cols + c;
        const day = run.type === "leading"
          ? prevLastDay - leadingCount + 1 + offset
          : offset - trailingStart + 1;
        ctx.fillText(String(day), gridX + c * colW + 3 * scale, gridY + run.row * rowH + 9 * scale);
      }
    }
    ctx.fillStyle = "#999999";
    ctx.font = `italic ${pt(14, scale)}px Arial`;
    ctx.textAlign = "right";
    for (const run of emptyRuns) {
      const name = (run.type === "leading" ? prevMonthName : nextMonthName).slice(0, 3);
      for (let c = run.colStart; c <= run.colEnd; c++) {
        const cx = gridX + (c + 1) * colW - 3.5 * scale;
        const cy = gridY + run.row * rowH + 7 * scale;
        ctx.fillText(name, cx, cy);
      }
    }
  }

  // Teaching-week gutter labels.
  if (hasWeeksHere) {
    const monthFirst = new Date(year, monthIndex, 1);
    const row0Monday = addDays(monthFirst, -mondayIndex(monthFirst));
    ctx.fillStyle = "black";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${pt(16, scale)}px Arial`;
    for (let r = 0; r < rows; r++) {
      const wLabel = teachingWeeks.get(isoDate(addDays(row0Monday, r * 7)));
      if (wLabel) ctx.fillText(wLabel, base.gridX + gutter / 2, gridY + r * rowH + rowH / 2);
    }
  }
}

// ============================================================================
// PDF renderer (downloadable A4 landscape PDF, via jsPDF)
// ============================================================================

function drawPdfMonth(doc, year, monthIndex, labels) {
  const teachingWeeks = document.getElementById("teachingWeeks").checked ? teachingWeekMap() : null;
  const lang = document.getElementById("language").value || "en";
  const monthNames = MONTH_NAMES[lang] || MONTH_NAMES.en;
  const weekdayNames = WEEKDAYS[lang] || WEEKDAYS.en;
  const fullWeekdayNames = FULL_WEEKDAYS[lang] || FULL_WEEKDAYS.en;
  const base = layout(1);
  const { w, h, margin, headerH, gridY, gridH } = base;
  const rows = monthRows(year, monthIndex);
  const hasWeeksHere = monthHasTeachingWeeks(teachingWeeks, year, monthIndex, rows);
  const gutter = hasWeeksHere ? 13 : 0;
  const gridX = base.gridX + gutter;
  const gridW = base.gridW - gutter;
  const colW = gridW / 7;
  const rowH = gridH / rows;
  const leadingCount = mondayIndex(new Date(year, monthIndex, 1));
  const trailingStart = leadingCount + new Date(year, monthIndex + 1, 0).getDate();
  const notesArea = document.getElementById("notesArea").checked;
  const emptyRuns = computeEmptyRuns(leadingCount, trailingStart, rows);
  const emptyCells = new Set();
  for (const run of emptyRuns) for (let c = run.colStart; c <= run.colEnd; c++) emptyCells.add(run.row * 7 + c);
  const shadeWeekends = document.getElementById("shadeWeekends").checked;
  const zebraWeeks = document.getElementById("zebraWeeks").checked;
  const zebraColumns = document.getElementById("zebraColumns").checked;
  const guideLines = document.getElementById("guideLines").checked;
  const fullDayNames = document.getElementById("fullDayNames").checked;
  const shade = SHADE_THEMES[document.getElementById("shadeColour").value] || SHADE_THEMES.grey;
  const customRgb = LABEL_COLOURS[document.getElementById("customColour").value] || LABEL_COLOURS.black;

  // Background.
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, w, h, "F");

  // Title — "Month" in bold, " Year" regular, centred as a single line.
  // Title — month centred and bold; year smaller and right-aligned on the
  // same baseline (the month is the hero of the page; the year is metadata).
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(40);
  doc.text(monthNames[monthIndex], w / 2, margin + 8, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(22);
  doc.text(String(year), w - margin, margin + 8, { align: "right" });

  // Shading.
  if (zebraWeeks) {
    doc.setFillColor(...shade.zebra);
    for (let r = 1; r < rows; r += 2) doc.rect(gridX, gridY + r * rowH, gridW, rowH, "F");
  }
  if (zebraColumns) {
    doc.setFillColor(...shade.zebra);
    for (let c = 1; c < 7; c += 2) doc.rect(gridX + c * colW, gridY, colW, gridH, "F");
  }
  if (shadeWeekends) {
    doc.setFillColor(...shade.weekend);
    for (const col of [5, 6]) doc.rect(gridX + col * colW, gridY, colW, gridH, "F");
  }
  if (notesArea) {
    doc.setFillColor(255, 255, 255);
    for (const run of emptyRuns) {
      doc.rect(gridX + run.colStart * colW, gridY + run.row * rowH, (run.colEnd - run.colStart + 1) * colW, rowH, "F");
    }
  }

  // Weekday header (auto-shrinks if the full names don't fit).
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  const weekdayLabels = fullDayNames ? fullWeekdayNames : weekdayNames;
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

  // Writing guide lines — see drawCalendar for the slot model.
  if (guideLines) {
    const lines = baseGuideLines(rows);
    doc.setDrawColor(204, 204, 204);
    doc.setLineWidth(0.6);
    doc.setLineDashPattern([2, 3], 0);
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < 7; col++) {
        if (notesArea && emptyCells.has(r * 7 + col)) continue;
        const x0 = gridX + col * colW + 3;
        const x1 = gridX + (col + 1) * colW - 3;
        const yt = gridY + r * rowH;
        const yb = yt + rowH;
        const spacing = (yb - (yt + 9)) / (lines + 1);
        for (let k = 1; k <= lines; k++) doc.line(x0, yt + 9 + k * spacing, x1, yt + 9 + k * spacing);
      }
    }
    if (notesArea) {
      for (const run of emptyRuns) {
        const x0 = gridX + run.colStart * colW + 3;
        const x1 = gridX + (run.colEnd + 1) * colW - 3;
        const yt = gridY + run.row * rowH;
        const yb = yt + rowH;
        const spacing = (yb - (yt + 9)) / (lines + 1);
        for (let k = 1; k <= lines; k++) doc.line(x0, yt + 9 + k * spacing, x1, yt + 9 + k * spacing);
      }
    }
    doc.setLineDashPattern([], 0);
  }

  // Grid borders. In Notes mode the internal vertical between two empty
  // cells in the same row is skipped, merging them into one visual block.
  doc.setDrawColor(34, 34, 34);
  doc.setLineWidth(0.7);
  doc.rect(gridX, gridY, gridW, gridH);
  if (notesArea) {
    for (let r = 0; r < rows; r++) {
      const yt = gridY + r * rowH;
      const yb = yt + rowH;
      for (let i = 1; i < 7; i++) {
        if (emptyCells.has(r * 7 + (i - 1)) && emptyCells.has(r * 7 + i)) continue;
        doc.line(gridX + i * colW, yt, gridX + i * colW, yb);
      }
    }
  } else {
    for (let i = 1; i < 7; i++) doc.line(gridX + i * colW, gridY, gridX + i * colW, gridY + gridH);
  }
  for (let j = 1; j < rows; j++) doc.line(gridX, gridY + j * rowH, gridX + gridW, gridY + j * rowH);

  // Day numbers + bottom-left labels.
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
    doc.text(String(day), x + 3, y + 9);

    // Slot the labels into the equispaced cell slots — see drawCalendar.
    const stack = labelStack(labels.get(isoDate(d)));
    if (stack.length) {
      const slots = baseGuideLines(rows) + 1;
      const visible = stack.slice(-slots);
      const slotSpacing = (rowH - 9) / slots;
      const labelMaxW = colW - 6;
      visible.forEach((item, i) => {
        const text = item.text.slice(0, 32);
        doc.setFont("helvetica", item.custom ? "bolditalic" : "bold");
        if (item.custom) doc.setTextColor(...customRgb);
        else doc.setTextColor(0, 0, 0);
        let fontSize = 12;
        doc.setFontSize(fontSize);
        const textW = doc.getTextWidth(text);
        if (textW > labelMaxW) {
          fontSize *= labelMaxW / textW;
          doc.setFontSize(fontSize);
        }
        const slotIndex = slots - (visible.length - 1 - i);
        const slotBottom = y + 9 + slotIndex * slotSpacing;
        doc.text(text, x + 3, slotBottom - 2);
      });
    }
  }

  // Leading/trailing cells: either a "Notes" tag (Notes-area mode) or the
  // adjacent month's day numbers with a faint Jul/Sep abbreviation.
  if (notesArea && emptyRuns.length) {
    doc.setTextColor(153, 153, 153);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    for (const run of emptyRuns) {
      const cx = gridX + run.colStart * colW + 3.5;
      const cy = gridY + run.row * rowH + 6;
      doc.text("Notes", cx, cy);
    }
  }
  if (!notesArea && emptyRuns.length) {
    const prev = new Date(year, monthIndex, 0);
    const prevLastDay = prev.getDate();
    const prevMonthName = monthNames[prev.getMonth()];
    const nextMonthName = monthNames[(monthIndex + 1) % 12];
    doc.setTextColor(168, 168, 168);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    for (const run of emptyRuns) {
      for (let c = run.colStart; c <= run.colEnd; c++) {
        const offset = run.row * 7 + c;
        const day = run.type === "leading"
          ? prevLastDay - leadingCount + 1 + offset
          : offset - trailingStart + 1;
        doc.text(String(day), gridX + c * colW + 3, gridY + run.row * rowH + 9);
      }
    }
    doc.setTextColor(153, 153, 153);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(14);
    for (const run of emptyRuns) {
      const name = (run.type === "leading" ? prevMonthName : nextMonthName).slice(0, 3);
      for (let c = run.colStart; c <= run.colEnd; c++) {
        const cx = gridX + (c + 1) * colW - 3.5;
        const cy = gridY + run.row * rowH + 7;
        doc.text(name, cx, cy, { align: "right" });
      }
    }
  }

  // Teaching-week gutter labels.
  if (hasWeeksHere) {
    const monthFirst = new Date(year, monthIndex, 1);
    const row0Monday = addDays(monthFirst, -mondayIndex(monthFirst));
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    for (let r = 0; r < rows; r++) {
      const wLabel = teachingWeeks.get(isoDate(addDays(row0Monday, r * 7)));
      if (wLabel) doc.text(wLabel, base.gridX + gutter / 2, gridY + r * rowH + rowH / 2, { align: "center", baseline: "middle" });
    }
  }
}

// Builds the multi-page jsPDF document for the current selection — used by
// both Download (saves a file) and Print (opens in a new tab with autoPrint).
function buildPdfDoc() {
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
  return doc;
}

function downloadPdf() {
  const year = Number(document.getElementById("year").value);
  const monthValue = document.getElementById("month").value;
  const doc = buildPdfDoc();
  const name = monthValue === "all" ? `calendar_${year}.pdf` : `${MONTH_NAMES.en[Number(monthValue)].toLowerCase()}_${year}.pdf`;
  doc.save(name);
}

// Generates the same PDF as downloadPdf but opens it in a new tab with
// autoPrint set, so the browser's print dialog appears immediately.
function printCalendar() {
  const doc = buildPdfDoc();
  doc.autoPrint();
  window.open(doc.output("bloburl"));
}

// ============================================================================
// Preview UI: month navigation, click-to-add, recurring-date helper form
// ============================================================================

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
    shadeColour: document.getElementById("shadeColour").value,
    customColour: document.getElementById("customColour").value,
    notesArea: document.getElementById("notesArea").checked,
    lang: document.getElementById("language").value,
  });
  updateMonthNav();
}

// Disables the prev/next arrows in full-year mode (no single month to step
// from). The Year and Month dropdowns serve as the visual label themselves.
function updateMonthNav() {
  const isFullYear = document.getElementById("month").value === "all";
  document.getElementById("prevMonthBtn").disabled = isFullYear;
  document.getElementById("nextMonthBtn").disabled = isFullYear;
}

// Steps the Month selector by delta months, rolling the Year over at the
// December/January boundary. Clamps at the bounds of the year dropdown.
function stepMonth(delta) {
  const monthSelect = document.getElementById("month");
  if (monthSelect.value === "all") return;
  const yearInput = document.getElementById("year");
  let month = Number(monthSelect.value) + delta;
  let year = Number(yearInput.value);
  if (month > 11) { month = 0; year += 1; }
  else if (month < 0) { month = 11; year -= 1; }
  if (year < MIN_YEAR || year > MAX_YEAR) return;
  monthSelect.value = String(month);
  yearInput.value = String(year);
  renderPreview();
}

// Click on a day in the preview canvas -> prompt for a label, append a
// "YYYY-MM-DD | Label" line to the Custom dates textarea.
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

  openDayDialog(isoDate(new Date(year, monthIndex, day)));
}

// ============================================================================
// Day editor — modal that mirrors a day cell and lets you click slots to
// add, edit or delete custom-date labels for that day.
// ============================================================================

// Renders ONE day cell into `canvas` using the same drawing rules as
// drawCalendar so the modal preview is pixel-faithful to the printed
// output. Returns the slot rectangles (in canvas-pixel coordinates) so
// the caller can position click-hit zones and inline editors over them.
function drawCellOnCanvas(canvas, year, monthIndex, day, entry, options) {
  const ctx = canvas.getContext("2d");
  const rows = monthRows(year, monthIndex);
  const cellMmW = 39.6;                       // colW = (297 - 2*7) / 7
  const cellMmH = rows === 6 ? 28 : 33.6;     // rowH = (210 - 2*7 - 22) / rows
  const scale = Math.min(canvas.width / cellMmW, canvas.height / cellMmH);
  const cellW = cellMmW * scale;
  const cellH = cellMmH * scale;
  const cellX = (canvas.width - cellW) / 2;
  const cellY = (canvas.height - cellH) / 2;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Where this day sits in the month grid (drives zebra + weekend shading).
  const firstWeekday = mondayIndex(new Date(year, monthIndex, 1));
  const dayOffset = (day - 1) + firstWeekday;
  const cellRow = Math.floor(dayOffset / 7);
  const cellCol = dayOffset % 7;

  // Cell background — white, then layered shading, in the same order as
  // drawCalendar (zebra first, weekend overrides).
  ctx.fillStyle = "white";
  ctx.fillRect(cellX, cellY, cellW, cellH);
  const shade = SHADE_THEMES[options.shadeColour] || SHADE_THEMES.grey;
  if (options.zebraWeeks && cellRow % 2 === 1) {
    ctx.fillStyle = rgbCss(shade.zebra);
    ctx.fillRect(cellX, cellY, cellW, cellH);
  }
  if (options.zebraColumns && cellCol % 2 === 1) {
    ctx.fillStyle = rgbCss(shade.zebra);
    ctx.fillRect(cellX, cellY, cellW, cellH);
  }
  if (options.shadeWeekends && cellCol >= 5) {
    ctx.fillStyle = rgbCss(shade.weekend);
    ctx.fillRect(cellX, cellY, cellW, cellH);
  }

  // Writing-guide dashes — equispaced between day-number baseline and bottom.
  const lines = baseGuideLines(rows);
  if (options.guideLines) {
    ctx.save();
    ctx.strokeStyle = "#cccccc";
    ctx.lineWidth = 0.6 * scale;
    ctx.setLineDash([2 * scale, 3 * scale]);
    const x0 = cellX + 3 * scale;
    const x1 = cellX + cellW - 3 * scale;
    const yStart = cellY + 9 * scale;
    const spacing = (cellH - 9 * scale) / (lines + 1);
    for (let k = 1; k <= lines; k++) {
      const y = yStart + k * spacing;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Cell border.
  ctx.strokeStyle = "#222222";
  ctx.lineWidth = 0.7 * scale;
  ctx.strokeRect(cellX, cellY, cellW, cellH);

  // Day number, top-left.
  ctx.fillStyle = "black";
  ctx.font = `bold ${pt(22, scale)}px Arial`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(String(day), cellX + 3 * scale, cellY + 9 * scale);

  // Labels, slotted from the bottom up — same maths as drawCalendar.
  const customCss = rgbCss(LABEL_COLOURS[options.customColour] || LABEL_COLOURS.black);
  const stack = labelStack(entry);
  const slots = lines + 1;
  const visible = stack.slice(-slots);
  const slotSpacing = (cellH - 9 * scale) / slots;
  const labelMaxW = cellW - 6 * scale;
  visible.forEach((item, i) => {
    const text = item.text.slice(0, 32);
    const weight = item.custom ? "italic bold" : "bold";
    let labelPt = 12;
    ctx.font = `${weight} ${pt(labelPt, scale)}px Arial`;
    const textW = ctx.measureText(text).width;
    if (textW > labelMaxW) {
      labelPt *= labelMaxW / textW;
      ctx.font = `${weight} ${pt(labelPt, scale)}px Arial`;
    }
    ctx.fillStyle = item.custom ? customCss : "black";
    const slotIndex = slots - (visible.length - 1 - i);
    const slotBottom = cellY + 9 * scale + slotIndex * slotSpacing;
    ctx.fillText(text, cellX + 3 * scale, slotBottom - 2 * scale);
  });

  // Slot rectangles for hit-testing — slot k sits between dash k-1 and dash k
  // (with dash 0 being the day-number baseline and dash N being the cell
  // bottom). All values in canvas-pixel coordinates.
  const slotRects = [];
  for (let k = 1; k <= slots; k++) {
    const yTop = cellY + 9 * scale + (k - 1) * slotSpacing;
    const yBot = cellY + 9 * scale + k * slotSpacing;
    slotRects.push({ x: cellX, y: yTop, w: cellW, h: yBot - yTop, slotIndex: k });
  }
  return { slotRects, cellX, cellY, cellW, cellH };
}

// Parses a single Custom dates textarea line. Returns { date, label, rule }
// or null for blanks, comments, or anything that doesn't match the format.
function parseCustomDateLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const parts = trimmed.split("|").map((s) => s.trim());
  if (parts.length < 2) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(parts[0]) || !parts[1]) return null;
  return { date: parts[0], label: parts[1], rule: parts.slice(2).join("|") || null };
}

// Index of the textarea line that defines a one-off entry for (date, label),
// or -1 if no such line exists (the label comes from a recurrence expansion
// or a holiday and shouldn't be edited in place here).
function findOneOffLineIndex(date, label) {
  const lines = document.getElementById("customDates").value.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const parsed = parseCustomDateLine(lines[i]);
    if (parsed && parsed.date === date && parsed.label === label && !parsed.rule) {
      return i;
    }
  }
  return -1;
}

// Replaces (or removes, if `newLine` is empty) one line in the Custom dates
// textarea, then re-renders the preview. Keeps the rest of the textarea
// content — including comments and recurrence rules — exactly as it was.
function replaceCustomDateLine(index, newLine) {
  const box = document.getElementById("customDates");
  const lines = box.value.split("\n");
  if (newLine === "") lines.splice(index, 1);
  else lines[index] = newLine;
  box.value = lines.join("\n").replace(/\n+$/, "");
  renderPreview();
}

function openDayDialog(date) {
  const dialog = document.getElementById("dayDialog");
  dialog.dataset.date = date;
  // showModal first so the wrap's clientWidth is measurable when we render.
  if (!dialog.open) dialog.showModal();
  renderDayDialogCell();
}

function closeDayDialog() {
  const dialog = document.getElementById("dayDialog");
  if (dialog.open) dialog.close();
  delete dialog.dataset.date;
}

function renderDayDialogCell() {
  const dialog = document.getElementById("dayDialog");
  const date = dialog.dataset.date;
  if (!date) return;
  const [yStr, mStr, dStr] = date.split("-");
  const year = Number(yStr);
  const monthIndex = Number(mStr) - 1;
  const day = Number(dStr);
  const rows = monthRows(year, monthIndex);

  const lang = document.getElementById("language").value || "en";
  const locale = lang === "ga" ? "ga-IE" : "en-IE";
  document.getElementById("dayDialogTitle").textContent =
    new Date(year, monthIndex, day).toLocaleDateString(locale, {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });

  // Size the canvas to the wrap's CSS width, keeping the cell's aspect.
  // The internal canvas buffer is upscaled by devicePixelRatio for crisp
  // text on high-DPI screens.
  const wrap = document.getElementById("dayDialogWrap");
  const canvas = document.getElementById("dayDialogCanvas");
  const cellMmH = rows === 6 ? 28 : 33.6;
  const aspect = 39.6 / cellMmH;
  const cssWidth = wrap.clientWidth || 480;
  const cssHeight = cssWidth / aspect;
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = cssWidth + "px";
  canvas.style.height = cssHeight + "px";
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);

  const options = {
    shadeWeekends: document.getElementById("shadeWeekends").checked,
    zebraWeeks: document.getElementById("zebraWeeks").checked,
    zebraColumns: document.getElementById("zebraColumns").checked,
    guideLines: document.getElementById("guideLines").checked,
    shadeColour: document.getElementById("shadeColour").value,
    customColour: document.getElementById("customColour").value,
  };
  const entry = buildLabels(year).get(date) || { holiday: null, custom: [] };
  const result = drawCellOnCanvas(canvas, year, monthIndex, day, entry, options);

  // Build invisible click-hit buttons in CSS-pixel coordinates over each
  // slot. Empty slots reveal "+ Add a reminder" on hover; editable slots
  // tint blue; readonly slots show a tooltip but don't react.
  const overlay = document.getElementById("dayDialogOverlay");
  overlay.innerHTML = "";
  const stack = labelStack(entry);
  const slots = baseGuideLines(rows) + 1;
  const visible = stack.slice(-slots);
  const firstVisibleSlot = slots - visible.length + 1;
  for (const rect of result.slotRects) {
    const slotIndex = rect.slotIndex;
    const indexInVisible = slotIndex - firstVisibleSlot;
    const item = (indexInVisible >= 0 && indexInVisible < visible.length) ? visible[indexInVisible] : null;
    overlay.appendChild(buildSlotHit(date, item, rect, dpr));
  }
}

function buildSlotHit(date, item, rect, dpr) {
  const hit = document.createElement("button");
  hit.type = "button";
  hit.className = "slot-hit";
  // Canvas coords → CSS coords (the canvas is upscaled by dpr internally).
  hit.style.left = (rect.x / dpr) + "px";
  hit.style.top = (rect.y / dpr) + "px";
  hit.style.width = (rect.w / dpr) + "px";
  hit.style.height = (rect.h / dpr) + "px";

  if (!item) {
    hit.classList.add("empty");
    hit.textContent = "+ Add a reminder";
    hit.addEventListener("click", () => beginSlotEdit(hit, "", -1, false));
    return hit;
  }

  if (!item.custom) {
    hit.classList.add("readonly");
    hit.title = "Public holiday";
    return hit;
  }

  const sourceIndex = findOneOffLineIndex(date, item.text);
  if (sourceIndex < 0) {
    hit.classList.add("readonly");
    hit.title = "Comes from a recurring rule — edit in the Custom dates box";
    return hit;
  }
  hit.addEventListener("click", () => beginSlotEdit(hit, item.text, sourceIndex, true));
  return hit;
}

// Swap the hit button for an inline text input over the same slot region.
// Enter saves, Escape reverts, blur commits whatever's in the input.
function beginSlotEdit(hitButton, currentValue, sourceIndex, isCustom) {
  const editor = document.createElement("div");
  editor.className = "slot-editor";
  editor.style.left = hitButton.style.left;
  editor.style.top = hitButton.style.top;
  editor.style.width = hitButton.style.width;
  editor.style.height = hitButton.style.height;

  const input = document.createElement("input");
  input.type = "text";
  input.value = currentValue;
  input.placeholder = "Reminder";
  input.spellcheck = false;
  input.maxLength = 64;
  if (isCustom) input.style.fontStyle = "italic";
  editor.appendChild(input);

  let committed = false;
  const date = document.getElementById("dayDialog").dataset.date;
  const commit = () => {
    if (committed) return;
    committed = true;
    const next = input.value.trim();
    if (sourceIndex >= 0) {
      if (next === "") replaceCustomDateLine(sourceIndex, "");
      else if (next !== currentValue) replaceCustomDateLine(sourceIndex, `${date} | ${next}`);
    } else if (next !== "") {
      appendCustomDateLine(`${date} | ${next}`);
    }
    renderDayDialogCell();
  };
  const cancel = () => {
    if (committed) return;
    committed = true;
    renderDayDialogCell();
  };

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); commit(); }
    else if (event.key === "Escape") { event.preventDefault(); cancel(); }
  });
  input.addEventListener("blur", commit);

  hitButton.replaceWith(editor);
  setTimeout(() => { input.focus(); input.select(); }, 0);
}

// Builds a custom-date line (with optional recurrence) from the quick-add
// inputs above the textarea and appends it to the Custom dates box.
// Reads the quick-add form (date / label / repeats / ends) and appends one
// `YYYY-MM-DD | Label | rule` line to the custom-dates textarea. The Repeats
// dropdown's option values ARE the rule strings (e.g. "every 2 weeks",
// "first tuesday of month") so the form maps one-to-one onto parseRule's
// grammar — no per-option translation table needed.
function addRecurringDate() {
  const date = document.getElementById("recurDate").value;
  const label = document.getElementById("recurLabel").value.trim();
  const freq = document.getElementById("recurFreq").value;
  const endMode = document.getElementById("recurEnd").value;
  const countRaw = document.getElementById("recurCount").value.trim();
  const untilDate = document.getElementById("recurUntil").value;
  if (!date || !label) {
    window.alert("Pick a date and enter a label first.");
    return;
  }
  let line = `${date} | ${label}`;
  if (freq) {
    let rule = freq;
    if (endMode === "count" && Number(countRaw) > 0) rule += ` x ${Number(countRaw)}`;
    else if (endMode === "until" && untilDate) rule += ` until ${untilDate}`;
    line += ` | ${rule}`;
  }
  appendCustomDateLine(line);
  document.getElementById("recurLabel").value = "";
  document.getElementById("recurCount").value = "";
  document.getElementById("recurUntil").value = "";
}

// Show/hide the contextual sub-controls in the quick-add form:
//   Repeats=Just once  → no Ends row at all
//   Repeats=anything else  → Ends row visible
//     Ends=Forever       → no further input
//     Ends=Stops after…  → number input visible
//     Ends=Stops on date → date input visible
function updateQuickAddVisibility() {
  const freq = document.getElementById("recurFreq").value;
  const endMode = document.getElementById("recurEnd").value;
  document.getElementById("recurEndRow").hidden = !freq;
  document.getElementById("recurCount").hidden = !freq || endMode !== "count";
  document.getElementById("recurUntil").hidden = !freq || endMode !== "until";
}

// Shared helper: append one or more lines to the Custom dates textarea and
// re-render the preview.
function appendCustomDateLine(text) {
  const box = document.getElementById("customDates");
  const current = box.value.replace(/\s+$/, "");
  box.value = (current ? current + "\n" : "") + text;
  renderPreview();
}

// ============================================================================
// .ics import (Outlook/Google/Apple)
// ============================================================================

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
  appendCustomDateLine(lines.join("\n"));
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

// ============================================================================
// Persistence: saved calendars and reusable date groups (localStorage)
// ============================================================================

// Generic JSON-object localStorage helpers; the two stores below differ
// only in their key and the shape of values stored.
function readStore(key) {
  try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; }
}
function writeStore(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); return true; } catch { return false; }
}

const readSavedCalendars = () => readStore(STORAGE_KEY);
const writeSavedCalendars = (data) => writeStore(STORAGE_KEY, data);
const readGroups = () => readStore(GROUPS_KEY);
const writeGroups = (data) => writeStore(GROUPS_KEY, data);

function currentSettings() {
  return {
    year: document.getElementById("year").value,
    month: document.getElementById("month").value,
    country: document.getElementById("country").value,
    shadeWeekends: document.getElementById("shadeWeekends").checked,
    zebraWeeks: document.getElementById("zebraWeeks").checked,
    zebraColumns: document.getElementById("zebraColumns").checked,
    guideLines: document.getElementById("guideLines").checked,
    fullDayNames: document.getElementById("fullDayNames").checked,
    teachingWeeks: document.getElementById("teachingWeeks").checked,
    s1Start: document.getElementById("s1Start").value,
    s1Break: document.getElementById("s1Break").value,
    s2Start: document.getElementById("s2Start").value,
    s2Break: document.getElementById("s2Break").value,
    shadeColour: document.getElementById("shadeColour").value,
    customColour: document.getElementById("customColour").value,
    notesArea: document.getElementById("notesArea").checked,
    language: document.getElementById("language").value,
    customDates: document.getElementById("customDates").value,
  };
}

function applySettings(settings) {
  const savedYear = Number(settings.year);
  document.getElementById("year").value = savedYear >= MIN_YEAR && savedYear <= MAX_YEAR ? String(savedYear) : String(MIN_YEAR);
  document.getElementById("month").value = settings.month;
  document.getElementById("country").value = settings.country;
  document.getElementById("shadeWeekends").checked = settings.shadeWeekends;
  document.getElementById("zebraWeeks").checked = settings.zebraWeeks;
  document.getElementById("zebraColumns").checked = settings.zebraColumns;
  document.getElementById("guideLines").checked = settings.guideLines;
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
  document.getElementById("shadeColour").value = settings.shadeColour || "grey";
  document.getElementById("customColour").value = settings.customColour || "black";
  document.getElementById("notesArea").checked = !!settings.notesArea;
  document.getElementById("language").value = settings.language || "en";
  document.getElementById("customDates").value = settings.customDates;
  updateTeachingPanel();
  applyLanguage();
  renderPreview();
}

// Refreshes a named-items dropdown (saved calendars or date groups). The
// dropdown is disabled along with its dependent buttons when the store is
// empty, and shows a placeholder "no X yet" line.
function refreshNamedList({ selectId, names, emptyText, selectedName, disabledIds }) {
  const select = document.getElementById(selectId);
  select.innerHTML = "";
  const sorted = [...names].sort((a, b) => a.localeCompare(b));
  for (const name of sorted) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  }
  if (sorted.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = emptyText;
    select.appendChild(option);
  }
  if (selectedName && sorted.includes(selectedName)) select.value = selectedName;
  const empty = sorted.length === 0;
  select.disabled = empty;
  for (const id of disabledIds) document.getElementById(id).disabled = empty;
}

function refreshSavedList(selectedName) {
  refreshNamedList({
    selectId: "savedCalendars",
    names: Object.keys(readSavedCalendars()),
    emptyText: "No saved calendars yet",
    selectedName,
    disabledIds: ["loadBtn", "deleteBtn"],
  });
}

function refreshGroupList(selectedName) {
  refreshNamedList({
    selectId: "customGroups",
    names: Object.keys(readGroups()),
    emptyText: "No saved groups yet",
    selectedName,
    disabledIds: ["addGroupBtn", "deleteGroupBtn"],
  });
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
  appendCustomDateLine(text);
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

// ============================================================================
// Setup drawer (the mobile slide-in menu)
// ============================================================================

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

// ============================================================================
// Init — wires the UI once the DOM is ready.
// ============================================================================

// Form inputs that should trigger a re-render on every input/change event.
const RENDER_TRIGGER_IDS = [
  "year", "month", "country",
  "shadeWeekends", "zebraWeeks", "zebraColumns", "guideLines",
  "shadeColour", "customColour", "notesArea",
  "fullDayNames", "teachingWeeks",
  "s1Start", "s1Break", "s2Start", "s2Break",
  "customDates",
];

// ============================================================================
// Sharing: copy-a-URL link + .json file export/import
// ----------------------------------------------------------------------------
// A share payload is just `{ v, name, settings }` (the same `settings` shape
// that saveCalendar persists). It is delivered either as URL-safe base64 in
// `location.hash` or as a downloaded .json file. No third-party service is
// involved — the entire payload travels with the link or the file, keeping
// the user's dates off any server.
// ============================================================================

const SHARE_KEY = "cal";
const SHARE_VERSION = 1;

// URL-safe base64 with full Unicode support (no `+`, `/` or `=` padding).
function shareEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
function shareDecode(str) {
  const pad = (4 - (str.length % 4)) % 4;
  const base = (str + "=".repeat(pad)).replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(base);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function buildSharePayload() {
  return {
    v: SHARE_VERSION,
    name: document.getElementById("calendarName").value.trim(),
    settings: currentSettings(),
  };
}

function applySharePayload(payload) {
  if (!payload || payload.v !== SHARE_VERSION || !payload.settings) return false;
  applySettings(payload.settings);
  if (payload.name) document.getElementById("calendarName").value = payload.name;
  return true;
}

function flashButton(id, message, ms = 1600) {
  const btn = document.getElementById(id);
  const original = btn.textContent;
  btn.textContent = message;
  btn.disabled = true;
  setTimeout(() => { btn.textContent = original; btn.disabled = false; }, ms);
}

function copyShareLink() {
  const encoded = shareEncode(JSON.stringify(buildSharePayload()));
  const url = `${location.origin}${location.pathname}#${SHARE_KEY}=${encoded}`;
  const fallback = () => window.prompt("Copy this link to share the calendar:", url);
  if (!navigator.clipboard?.writeText) { fallback(); return; }
  navigator.clipboard.writeText(url)
    .then(() => flashButton("shareLinkBtn", "Link copied"))
    .catch(fallback);
}

function exportCalendarFile() {
  const payload = buildSharePayload();
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const safeName = (payload.name || "calendar").replaceAll(/[^a-z0-9_-]+/gi, "-") || "calendar";
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName}.calendar.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importCalendarFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);
      if (!applySharePayload(payload)) throw new Error("not a shareable calendar file");
    } catch (e) {
      window.alert(`Could not read that file — ${e.message}.`);
    }
  };
  reader.onerror = () => window.alert("Could not read that file.");
  reader.readAsText(file);
}

// Returns true if a `#cal=...` payload was found and applied. Always strips
// the hash so the URL doesn't carry the payload around after the first load.
function loadFromHashIfPresent() {
  const hash = location.hash.replace(/^#/, "");
  if (!hash.startsWith(`${SHARE_KEY}=`)) return false;
  const encoded = hash.slice(SHARE_KEY.length + 1);
  let applied = false;
  try {
    applied = applySharePayload(JSON.parse(shareDecode(encoded)));
  } catch {
    // Malformed share data — leave the defaults in place rather than crash.
  }
  history.replaceState(null, "", location.pathname + location.search);
  return applied;
}

window.addEventListener("DOMContentLoaded", () => {
  // Bail out when the generator controls aren't present (e.g. the tests.html
  // page loads this script for its pure helpers and has no UI of its own).
  if (!document.getElementById("previewBtn")) return;

  // Populate the Year dropdown and pick sensible defaults for both year/month.
  const yearSelect = document.getElementById("year");
  for (let y = MIN_YEAR; y <= MAX_YEAR; y++) {
    const opt = document.createElement("option");
    opt.value = String(y);
    opt.textContent = String(y);
    yearSelect.appendChild(opt);
  }
  yearSelect.value = String(MIN_YEAR);
  document.getElementById("month").value = String(new Date().getMonth());

  // Preview controls.
  document.getElementById("previewBtn").addEventListener("click", renderPreview);
  document.getElementById("downloadBtn").addEventListener("click", downloadPdf);
  document.getElementById("printBtn").addEventListener("click", printCalendar);
  document.getElementById("preview").addEventListener("click", handlePreviewClick);
  document.getElementById("dayDialogClose").addEventListener("click", closeDayDialog);
  // Click on the backdrop (outside the dialog box) closes the dialog.
  document.getElementById("dayDialog").addEventListener("click", (event) => {
    if (event.target.id === "dayDialog") closeDayDialog();
  });
  document.getElementById("prevMonthBtn").addEventListener("click", () => stepMonth(-1));
  document.getElementById("nextMonthBtn").addEventListener("click", () => stepMonth(1));

  // Drawer (hamburger menu) controls.
  document.getElementById("menuBtn").addEventListener("click", toggleDrawer);
  document.getElementById("drawerCloseBtn").addEventListener("click", () => {
    closeDrawer();
    document.getElementById("menuBtn").focus();
  });
  document.getElementById("scrim").addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDrawer();
  });

  // Saved-calendar and date-group controls.
  document.getElementById("saveBtn").addEventListener("click", saveCalendar);
  document.getElementById("loadBtn").addEventListener("click", loadCalendar);
  document.getElementById("deleteBtn").addEventListener("click", deleteCalendar);
  document.getElementById("saveGroupBtn").addEventListener("click", saveGroup);
  document.getElementById("addGroupBtn").addEventListener("click", addGroup);
  document.getElementById("deleteGroupBtn").addEventListener("click", deleteGroup);

  // Sharing: copy link, download/import file.
  document.getElementById("shareLinkBtn").addEventListener("click", copyShareLink);
  document.getElementById("exportBtn").addEventListener("click", exportCalendarFile);
  document.getElementById("importBtn").addEventListener("click", () => document.getElementById("importFile").click());
  document.getElementById("importFile").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) importCalendarFile(file);
    event.target.value = "";  // allow re-importing the same file
  });

  // .ics import (drag-and-drop and file picker).
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

  // Custom-date quick-add form.
  document.getElementById("recurAddBtn").addEventListener("click", addRecurringDate);
  document.getElementById("recurFreq").addEventListener("change", updateQuickAddVisibility);
  document.getElementById("recurEnd").addEventListener("change", updateQuickAddVisibility);
  updateQuickAddVisibility();

  // Teaching-week schedule panel + auto-fill on year change.
  document.getElementById("autoFillWeeksBtn").addEventListener("click", () => {
    autoFillTeachingDates();
    renderPreview();
  });
  document.getElementById("teachingWeeks").addEventListener("change", updateTeachingPanel);
  document.getElementById("year").addEventListener("change", autoFillTeachingDates);
  document.getElementById("language").addEventListener("change", () => {
    applyLanguage();
    renderPreview();
  });

  // Re-render on any setting change.
  for (const id of RENDER_TRIGGER_IDS) {
    document.getElementById(id).addEventListener("input", renderPreview);
    document.getElementById(id).addEventListener("change", renderPreview);
  }

  refreshSavedList();
  refreshGroupList();
  autoFillTeachingDates();
  updateTeachingPanel();
  applyLanguage();
  // applySettings already calls renderPreview, so only render explicitly when
  // no shared payload was applied — avoids a visible flash of the defaults.
  if (!loadFromHashIfPresent()) renderPreview();
});
