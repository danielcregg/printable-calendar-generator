// Tiny browser-runnable test harness for the pure helpers in app.js. Open
// docs/tests.html in a served browser tab to run. Tests are grouped by
// concern; each prints pass/fail with an assertion message, and a banner
// at the end summarises the run.

(function () {
  const results = document.getElementById("results");
  let passed = 0;
  let failed = 0;
  let currentGroup = null;

  function group(name) {
    const section = document.createElement("section");
    section.innerHTML = `<h2>${name}</h2>`;
    results.appendChild(section);
    currentGroup = section;
  }

  function test(name, fn) {
    const line = document.createElement("div");
    try {
      fn();
      passed++;
      line.className = "pass";
      line.textContent = `✓ ${name}`;
    } catch (err) {
      failed++;
      line.className = "fail";
      line.textContent = `✗ ${name} — ${err.message}`;
    }
    (currentGroup || results).appendChild(line);
  }

  function assertEq(actual, expected, msg) {
    if (actual !== expected) {
      throw new Error(`${msg ? msg + ": " : ""}expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  }

  function assertDeep(actual, expected, msg) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) {
      throw new Error(`${msg ? msg + ": " : ""}expected ${e}, got ${a}`);
    }
  }

  // -- Date math ---------------------------------------------------------
  group("Date math");
  test("mondayIndex: Monday is 0", () => assertEq(mondayIndex(new Date(2026, 0, 5)), 0));
  test("mondayIndex: Sunday is 6", () => assertEq(mondayIndex(new Date(2026, 1, 1)), 6));
  test("isoDate pads month and day", () => assertEq(isoDate(new Date(2026, 0, 5)), "2026-01-05"));
  test("addDays across month boundary", () => assertEq(isoDate(addDays(new Date(2026, 0, 31), 1)), "2026-02-01"));
  test("firstMonday of Feb 2026 is Feb 2", () => assertEq(isoDate(firstMonday(2026, 1)), "2026-02-02"));
  test("lastMonday of Oct 2026 is Oct 26", () => assertEq(isoDate(lastMonday(2026, 9)), "2026-10-26"));
  test("easterSunday 2024 (Mar 31)", () => assertEq(isoDate(easterSunday(2024)), "2024-03-31"));
  test("easterSunday 2025 (Apr 20)", () => assertEq(isoDate(easterSunday(2025)), "2025-04-20"));
  test("easterSunday 2026 (Apr 5)", () => assertEq(isoDate(easterSunday(2026)), "2026-04-05"));
  test("easterSunday 2027 (Mar 28)", () => assertEq(isoDate(easterSunday(2027)), "2027-03-28"));

  // -- Ireland holidays --------------------------------------------------
  group("Ireland holidays (2026)");
  test("New Year's Day", () => assertEq(irelandHolidays(2026).get("2026-01-01"), "New Year's Day"));
  test("St Brigid's Day 2025 (first Monday)", () => assertEq(isoDate(stBrigidsDay(2025)), "2025-02-03"));
  test("St Brigid's Day 2026 (first Monday)", () => assertEq(isoDate(stBrigidsDay(2026)), "2026-02-02"));
  test("St Patrick's Day", () => assertEq(irelandHolidays(2026).get("2026-03-17"), "St Patrick's Day"));
  test("Good Friday", () => assertEq(irelandHolidays(2026).get("2026-04-03"), "Good Friday"));
  test("Easter Sunday", () => assertEq(irelandHolidays(2026).get("2026-04-05"), "Easter Sunday"));
  test("Easter Monday", () => assertEq(irelandHolidays(2026).get("2026-04-06"), "Easter Monday"));
  test("May Bank Holiday", () => assertEq(irelandHolidays(2026).get("2026-05-04"), "May Bank Holiday"));
  test("June Bank Holiday", () => assertEq(irelandHolidays(2026).get("2026-06-01"), "June Bank Holiday"));
  test("August Bank Holiday", () => assertEq(irelandHolidays(2026).get("2026-08-03"), "August Bank Holiday"));
  test("October Bank Holiday", () => assertEq(irelandHolidays(2026).get("2026-10-26"), "October Bank Holiday"));
  test("Christmas Day", () => assertEq(irelandHolidays(2026).get("2026-12-25"), "Christmas Day"));
  test("St Stephen's Day", () => assertEq(irelandHolidays(2026).get("2026-12-26"), "St Stephen's Day"));

  // -- AGENTS.md manual-checklist items ----------------------------------
  group("AGENTS.md checklist items");
  test("Jan 1 2026 is Thursday", () => assertEq(new Date(2026, 0, 1).getDay(), 4));
  test("Feb 1 2026 is Sunday", () => assertEq(new Date(2026, 1, 1).getDay(), 0));
  test("March 2026 uses 6 rows", () => assertEq(monthRows(2026, 2), 6));
  test("June 1 2026 is Monday", () => assertEq(new Date(2026, 5, 1).getDay(), 1));

  // -- Layout helpers ----------------------------------------------------
  group("Layout helpers");
  test("monthRows: Jan 2024 is 5 rows", () => assertEq(monthRows(2024, 0), 5));
  test("monthRows: Aug 2026 is 6 rows", () => assertEq(monthRows(2026, 7), 6));
  test("baseGuideLines: 5 rows -> 3", () => assertEq(baseGuideLines(5), 3));
  test("baseGuideLines: 6 rows -> 2", () => assertEq(baseGuideLines(6), 2));
  test("computeEmptyRuns: trailing only", () =>
    assertDeep(computeEmptyRuns(0, 30, 5), [{ row: 4, colStart: 2, colEnd: 6, type: "trailing" }]));
  test("computeEmptyRuns: leading + trailing", () =>
    assertDeep(computeEmptyRuns(3, 33, 5), [
      { row: 0, colStart: 0, colEnd: 2, type: "leading" },
      { row: 4, colStart: 5, colEnd: 6, type: "trailing" },
    ]));
  test("computeEmptyRuns: no leading or trailing", () =>
    assertDeep(computeEmptyRuns(0, 35, 5), []));

  // -- Label stacking ----------------------------------------------------
  group("Label stacking");
  test("labelStack: null entry yields []", () => assertDeep(labelStack(null), []));
  test("labelStack: holiday only", () =>
    assertDeep(labelStack({ holiday: "H", custom: [] }), [{ text: "H", custom: false }]));
  test("labelStack: customs above holiday", () =>
    assertDeep(labelStack({ holiday: "H", custom: ["A", "B"] }), [
      { text: "A", custom: true },
      { text: "B", custom: true },
      { text: "H", custom: false },
    ]));

  // -- Recurrence parser -------------------------------------------------
  group("Recurrence parser");
  test("parseRule: weekly", () =>
    assertDeep(parseRule("weekly"), { unit: "week", n: 1, count: null, until: null, exceptions: [] }));
  test("parseRule: yearly", () =>
    assertDeep(parseRule("yearly"), { unit: "year", n: 1, count: null, until: null, exceptions: [] }));
  test("parseRule: every 2 weeks", () =>
    assertDeep(parseRule("every 2 weeks"), { unit: "week", n: 2, count: null, until: null, exceptions: [] }));
  test("parseRule: every week (no explicit N)", () =>
    assertDeep(parseRule("every week"), { unit: "week", n: 1, count: null, until: null, exceptions: [] }));
  test("parseRule: weekly x 10", () =>
    assertDeep(parseRule("weekly x 10"), { unit: "week", n: 1, count: 10, until: null, exceptions: [] }));
  test("parseRule: every 2 weeks until DATE", () =>
    assertDeep(parseRule("every 2 weeks until 2026-12-31"),
      { unit: "week", n: 2, count: null, until: "2026-12-31", exceptions: [] }));
  test("parseRule: x N then until DATE", () =>
    assertDeep(parseRule("every 2 weeks x 5 until 2026-12-31"),
      { unit: "week", n: 2, count: 5, until: "2026-12-31", exceptions: [] }));
  test("parseRule: until DATE then x N (reversed)", () =>
    assertDeep(parseRule("every 2 weeks until 2026-12-31 x 5"),
      { unit: "week", n: 2, count: 5, until: "2026-12-31", exceptions: [] }));
  test("parseRule: case-insensitive shortcut", () =>
    assertDeep(parseRule("MONTHLY"), { unit: "month", n: 1, count: null, until: null, exceptions: [] }));
  test("parseRule: nonsense returns null", () => assertEq(parseRule("once a fortnight"), null));
  test("parseRule: first tuesday of month", () =>
    assertDeep(parseRule("first tuesday of month"),
      { unit: "nthWeekdayOfMonth", ordinal: 1, weekday: 1, n: 1, count: null, until: null, exceptions: [] }));
  test("parseRule: last friday of every month", () =>
    assertDeep(parseRule("last friday of every month"),
      { unit: "nthWeekdayOfMonth", ordinal: -1, weekday: 4, n: 1, count: null, until: null, exceptions: [] }));
  test("parseRule: 2nd monday of every 3 months with x N", () =>
    assertDeep(parseRule("2nd monday of every 3 months x 4"),
      { unit: "nthWeekdayOfMonth", ordinal: 2, weekday: 0, n: 3, count: 4, until: null, exceptions: [] }));
  test("parseRule: nth weekday accepts short weekday name", () =>
    assertDeep(parseRule("first tue of month"),
      { unit: "nthWeekdayOfMonth", ordinal: 1, weekday: 1, n: 1, count: null, until: null, exceptions: [] }));
  test("parseRule: except DATE suffix", () =>
    assertDeep(parseRule("every 2 weeks except 2026-04-06"),
      { unit: "week", n: 2, count: null, until: null, exceptions: ["2026-04-06"] }));
  test("parseRule: except with multiple dates", () =>
    assertDeep(parseRule("every week except 2026-04-06, 2026-05-04, 2026-06-01"),
      { unit: "week", n: 1, count: null, until: null, exceptions: ["2026-04-06", "2026-05-04", "2026-06-01"] }));
  test("parseRule: except combines with until and x N", () =>
    assertDeep(parseRule("every 2 weeks x 10 until 2026-12-31 except 2026-04-06"),
      { unit: "week", n: 2, count: 10, until: "2026-12-31", exceptions: ["2026-04-06"] }));

  // -- Recurrence expansion ----------------------------------------------
  group("Recurrence expansion");
  test("expandRule: no rule yields just the start", () =>
    assertDeep([...expandRule("2026-09-08", null, 2026)], ["2026-09-08"]));
  test("expandRule: weekly x 3", () =>
    assertDeep(
      [...expandRule("2026-09-15", { unit: "week", n: 1, count: 3, until: null }, 2026)],
      ["2026-09-15", "2026-09-22", "2026-09-29"]
    ));
  test("expandRule: every 2 weeks x 4", () =>
    assertDeep(
      [...expandRule("2026-09-08", { unit: "week", n: 2, count: 4, until: null }, 2026)],
      ["2026-09-08", "2026-09-22", "2026-10-06", "2026-10-20"]
    ));
  test("expandRule: until DATE caps inclusively", () =>
    assertDeep(
      [...expandRule("2026-09-08", { unit: "week", n: 1, count: null, until: "2026-09-22" }, 2026)],
      ["2026-09-08", "2026-09-15", "2026-09-22"]
    ));
  test("expandRule: yearly stops at year+2", () =>
    assertDeep(
      [...expandRule("2024-01-12", { unit: "year", n: 1, count: null, until: null }, 2026)],
      ["2024-01-12", "2025-01-12", "2026-01-12", "2027-01-12"]
    ));
  test("expandRule: monthly x 3 across year boundary", () =>
    assertDeep(
      [...expandRule("2026-11-15", { unit: "month", n: 1, count: 3, until: null }, 2026)],
      ["2026-11-15", "2026-12-15", "2027-01-15"]
    ));
  test("expandRule: first tuesday of month x 12 (Child Benefit through 2026)", () =>
    assertDeep(
      [...expandRule("2026-01-01", { unit: "nthWeekdayOfMonth", ordinal: 1, weekday: 1, n: 1, count: 12, until: null }, 2026)],
      [
        "2026-01-06", "2026-02-03", "2026-03-03", "2026-04-07",
        "2026-05-05", "2026-06-02", "2026-07-07", "2026-08-04",
        "2026-09-01", "2026-10-06", "2026-11-03", "2026-12-01",
      ]
    ));
  test("expandRule: last friday of every month x 3", () =>
    assertDeep(
      [...expandRule("2026-01-15", { unit: "nthWeekdayOfMonth", ordinal: -1, weekday: 4, n: 1, count: 3, until: null }, 2026)],
      ["2026-01-30", "2026-02-27", "2026-03-27"]
    ));
  test("expandRule: nth weekday ignores a non-matching literal start", () =>
    // Start date is Jan 15 (Thursday) — the rule yields the first Tuesday of
    // each month from January, NOT the literal start date.
    assertDeep(
      [...expandRule("2026-01-15", { unit: "nthWeekdayOfMonth", ordinal: 1, weekday: 1, n: 1, count: 2, until: null }, 2026)],
      ["2026-01-06", "2026-02-03"]
    ));
  test("nthWeekdayOfMonth: returns null when 5th occurrence doesn't exist", () =>
    // May 2026: 5 Tuesdays? May 5, 12, 19, 26 — only 4. A "5th tuesday" would
    // be null. We don't parse ordinal 5 from text, but the helper supports
    // arbitrary ordinals and should report when there isn't one.
    assertEq(nthWeekdayOfMonth(2026, 4, 5, 1), null));
  test("expandRule: except skips a single occurrence", () =>
    assertDeep(
      [...expandRule("2026-09-08", { unit: "week", n: 2, count: 4, until: null, exceptions: ["2026-09-22"] }, 2026)],
      ["2026-09-08", "2026-10-06", "2026-10-20", "2026-11-03"]
    ));
  test("expandRule: except on nth-weekday-of-month rule", () =>
    assertDeep(
      [...expandRule("2026-01-01", { unit: "nthWeekdayOfMonth", ordinal: 1, weekday: 1, n: 1, count: 4, until: null, exceptions: ["2026-04-07"] }, 2026)],
      ["2026-01-06", "2026-02-03", "2026-03-03", "2026-05-05"]
    ));

  // -- Custom-dates text parsing -----------------------------------------
  group("parseCustomDates");
  test("one-off date", () => {
    const m = parseCustomDates("2026-09-01 | School", 2026);
    assertEq(m.size, 1);
    assertDeep(m.get("2026-09-01"), ["School"]);
  });
  test("multiple labels on same date stack", () => {
    const m = parseCustomDates("2026-07-09 | A\n2026-07-09 | B", 2026);
    assertDeep(m.get("2026-07-09"), ["A", "B"]);
  });
  test("comment lines are ignored", () => {
    const m = parseCustomDates("# header\n2026-07-09 | X", 2026);
    assertEq(m.size, 1);
    assertEq(m.has("2026-07-09"), true);
  });
  test("recurrence rule expands", () => {
    const m = parseCustomDates("2026-09-15 | Swim | weekly x 3", 2026);
    assertEq(m.size, 3);
  });
  test("invalid line is skipped", () => {
    const m = parseCustomDates("garbage\n2026-07-09 | X", 2026);
    assertEq(m.size, 1);
  });

  // -- Summary -----------------------------------------------------------
  const summary = document.createElement("div");
  summary.className = `summary ${failed === 0 ? "ok" : "bad"}`;
  summary.textContent = `${passed} passed, ${failed} failed (of ${passed + failed} total)`;
  results.appendChild(summary);
})();
