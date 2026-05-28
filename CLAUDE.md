# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read AGENTS.md first

`AGENTS.md` is the authoritative spec for this project. It defines the design rules that
must be preserved, the tuned layout constants (margins, font sizes, positions), the
holiday policy, and a manual testing checklist. Read it before any layout change
— don't restate or contradict it here.

## Architecture

The whole project is a static web app in `docs/` — no build step, no server, and nothing
to install. It runs by opening `docs/index.html`, and is deployed as-is via GitHub Pages
(`main` branch, `/docs` folder).

- `app.js` — the entire engine: holiday math (Easter via the Anonymous Gregorian
  algorithm, the IE/GB bank-holiday rules), teaching-week (W1–W13) numbering, the
  5-vs-6 week-row calculation, Monday-offset day placement, rendering, the generator
  UI, saved calendars and date groups, optional share/publish through the worker, and
  PDF export.
- `index.html` / `styles.css` — the generator page.
- `docs/vendor/jspdf.umd.min.js` — jsPDF, bundled locally so the app depends on nothing
  online. There is no package manager; to change the jsPDF version, replace this file.
- `worker/` — optional Cloudflare Worker backing the Save & share panel's
  **Publish read-only** and **Live share** buttons. When the `cal-share-worker` meta
  tag in `index.html` is blank, those buttons stay hidden and the app makes no network
  calls.

## The one thing to keep in sync

`app.js` renders the calendar **twice**, and the two paths must agree:

- `drawCalendar` draws to a `<canvas>` — the on-screen preview.
- `drawPdfMonth` draws the same layout with jsPDF — the downloaded PDF.

Any layout change (positions, fonts, shading, a new option) has to land in **both**
functions, or the preview and the downloaded PDF will diverge. The PDF is the
print-quality output; the canvas preview is approximate because it uses the browser's
own font rendering.

## Running and testing

Serve the `docs/` folder with any static file server, or open `docs/index.html`
directly as a `file://` URL — both work for everything except the share/publish
buttons, which need an http(s) origin to reach the worker. There is no automated
test suite — verification is manual: download a PDF and walk the checklist in
`AGENTS.md`.
