# Possible future upgrades

Ideas worth considering but deliberately not built yet, to keep the site
focused on its one job: visitors come, customise a calendar, print it.

Add new ideas as a short heading + a paragraph or two explaining what it
was, why it's parked, and (if it was once shipped) where to find the
removed code in git history.

## .ics import — previously shipped, removed in cleanup

The drawer used to have an **Import .ics file** section that let you drag in
a calendar file (Outlook, Google, Apple), pick which `VEVENT` dates to add,
and write them into the Custom dates textarea. It supported `DTSTART`,
`SUMMARY`, and `FREQ=YEARLY`; it ignored time zones, multi-day events,
weekly/monthly recurrence, and `EXDATE`.

Removed because it was scope creep: most visitors won't have an `.ics` file
to bring, and typing custom dates into the textarea or quick-add form covers
the common case. The parser was clean and self-contained though — if it
ever earns its place back, the implementation lived in `docs/app.js`
(`parseIcs`, `loadIcsFile`, `showIcsResults`, `addIcsSelected`, `clearIcs`)
with matching CSS rules in `docs/styles.css` (`.ics-drop`, `.ics-results`,
`.ics-item`, `.ics-actions`) and a `<details>` drawer section in
`docs/index.html`. The pre-removal version is preserved in git history —
look at the commit just before the cleanup commit.

If you reinstate it, consider expanding the parser to handle weekly and
monthly RRULEs and EXDATE — the original only handled `FREQ=YEARLY`.

## Other parked ideas

- More country holiday providers (Scotland/NI split, US, etc).
- Sunday-start week option.
- Portrait orientation.
- Different paper sizes (Letter, A3).
- Localising weekday/month labels for languages other than English/Gaeilge.
