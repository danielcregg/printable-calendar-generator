# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read AGENTS.md first

`AGENTS.md` is the authoritative spec for this project. It defines the design rules that
must be preserved, the tuned layout constants (margins, font sizes, positions), the
Ireland holiday policy, and a manual testing checklist. Read it before any layout change
— don't restate or contradict it here.

## Architecture

The whole project is a static web app in `docs/` — no build step, no server, and nothing
to install. It runs by opening `docs/index.html`, and is deployed as-is via GitHub Pages
(`main` branch, `/docs` folder).

- `app.js` — the entire engine: Irish holiday math (Easter via the Anonymous Gregorian
  algorithm, the bank-holiday rules), teaching-week (W1–W13) numbering, the 5-vs-6
  week-row calculation, Monday-offset day placement, rendering, the generator UI,
  `.ics` import, saved calendars and date groups, and PDF export.
- `index.html` / `styles.css` — the generator page.
- `docs/vendor/jspdf.umd.min.js` — jsPDF, bundled locally so the app depends on nothing
  online. There is no package manager; to change the jsPDF version, replace this file.
- `manifest.json` + `sw.js` + `icons/` — the PWA layer. `sw.js` is a cache-first service
  worker that precaches the app shell, so the site is installable and runs fully offline.

`android-app-dev-guide.md` (repo root) is a standalone guide for porting the app to
Android; it is not part of the web app.

## The one thing to keep in sync

`app.js` renders the calendar **twice**, and the two paths must agree:

- `drawCalendar` draws to a `<canvas>` — the on-screen preview.
- `drawPdfMonth` draws the same layout with jsPDF — the downloaded PDF.

Any layout change (positions, fonts, shading, a new option) has to land in **both**
functions, or the preview and the downloaded PDF will diverge. The PDF is the
print-quality output; the canvas preview is approximate because it uses the browser's
own font rendering.

## When you change a cached asset

`sw.js` precaches the whole app shell. After changing any precached file (`app.js`,
`styles.css`, `index.html`, an icon, the vendored jsPDF, the manifest), **bump the
`CACHE` constant in `sw.js`** — otherwise returning visitors keep the stale cached copy.
The `?v=` query on the `<script>`/`<link>` tags does not help here: the service worker
matches with `ignoreSearch`, so it ignores that query.

## Running and testing

Serve the `docs/` folder with any static file server and open it in a browser. (Opening
`index.html` as a `file://` URL also works for the calendar itself, but the service
worker only registers over http/https.) There is no automated test suite — verification
is manual: download a PDF and walk the checklist in `AGENTS.md`.
