# Calendar sharing Worker

This directory holds the Cloudflare Worker that powers the optional **live
sharing** feature in the Printable Calendar Generator. It's a tiny
key-value store (HTTP GET / PUT against `https://<worker>/<calendarId>`)
backed by Workers KV. The app reads/writes through it so two devices can
keep the same calendar in sync without any accounts or sign-ins.

If you don't deploy the Worker, the rest of the app works fine — the
live-sharing UI just stays hidden. The static URL-share and `.json`
import/export features keep working with no Worker at all.

## Free-tier capacity

Comfortably more than enough for personal / family use:

| Limit | Free tier | Typical use per shared calendar |
|---|---|---|
| Reads / day | 100,000 | ~35,000 (two devices polling every 5 s) |
| Writes / day | 1,000 | Dozens (debounced on change) |
| Storage | 1 GB | A few KB |

## One-time setup

You need a free Cloudflare account and Node 18+ to run wrangler (the
Cloudflare CLI).

```sh
# 1. Install wrangler if you don't have it
npm install -g wrangler

# 2. Sign in to your Cloudflare account (opens a browser tab)
wrangler login

# 3. Create the KV namespace this Worker uses
cd worker
wrangler kv namespace create CAL_KV
#   → Outputs: { binding = "CAL_KV", id = "..." }

# 4. Copy the namespace id into your wrangler.toml
cp wrangler.toml.example wrangler.toml
#   Open wrangler.toml and replace REPLACE_WITH_KV_NAMESPACE_ID with the
#   id printed in step 3.

# 5. Deploy
wrangler deploy
#   → Outputs your Worker URL, e.g.
#     https://printcal-share.YOUR-SUBDOMAIN.workers.dev
```

## Point the static site at your Worker

Edit `docs/index.html` and replace the empty `content=""` on the
`cal-share-worker` meta tag with the Worker URL printed by the last
command:

```html
<meta name="cal-share-worker" content="https://printcal-share.YOUR-SUBDOMAIN.workers.dev">
```

Commit and push. The next time anyone loads the site the **Live
sharing** section in the Setup drawer will be enabled.

## API

`calendarId` is a 16–40 character `[A-Za-z0-9_-]` string.

- `GET /:id` — returns the stored calendar JSON (200) or 404 if not found.
- `PUT /:id` — writes a JSON body (≤ 200 KB), refreshes the 180-day TTL, and
  refreshes the `view` pointer used by the read-only viewer URL.
- `GET /view/:readId` — read-only resolution. `readId` is `sha256("view:"+id)`
  truncated to 12 bytes and url-safe-base64-encoded. The handler looks the
  readId up in KV and returns the underlying calendar, or 404 if there's no
  pointer.

CORS is open (`Access-Control-Allow-Origin: *`) so the static site can
call it from any origin. The owner's id acts as a bearer secret — anyone
who knows it can read or write. The derived readId can only read; even a
PUT against the readId would land at `cal:<readId>` (irrelevant garbage)
without affecting the publisher's `cal:<writeId>`.

## Security

The id is your only protection. Don't share live-calendar URLs
publicly. Treat them like a Google Doc "anyone with the link" share.
The Worker has no enumeration endpoint; ids are unguessable in
practice (~95 bits of entropy for the 16-char default), but if you
need stronger guarantees you'll need to add authentication.

## Cost

The free tier covers this comfortably. If you exceed it (you'd need
many simultaneous shared calendars), Cloudflare's paid Workers plan
starts at $5/month. Set up budget alerts in your Cloudflare account
if you're worried.

## Tearing down

To remove the Worker entirely:

```sh
wrangler delete
wrangler kv namespace delete --binding CAL_KV
```

Then blank out the `cal-share-worker` meta tag in `docs/index.html`
to hide the live-sharing UI again.
