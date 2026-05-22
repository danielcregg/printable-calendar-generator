// Standalone "this month" page: renders the current month with today
// highlighted, reusing the shared calendar logic from app.js.
function renderTodayCalendar() {
  const canvas = document.getElementById("todayCanvas");
  const ctx = canvas.getContext("2d");
  const scale = canvas.width / 297;
  const today = new Date();
  const year = today.getFullYear();
  const monthIndex = today.getMonth();

  const labels = new Map();
  for (const [date, holiday] of irelandHolidays(year)) {
    labels.set(date, { holiday, custom: null });
  }

  drawCalendar(ctx, year, monthIndex, labels, scale, {
    shadeWeekends: true,
    zebraWeeks: false,
    guideLines: false,
    highlightDate: isoDate(today),
  });

  document.getElementById("todayHeading").textContent =
    today.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

renderTodayCalendar();
