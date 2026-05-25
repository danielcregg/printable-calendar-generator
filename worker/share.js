// Cloudflare Worker for live calendar sharing.
//
// Stores opaque calendar IDs in a Workers KV namespace as JSON blobs.
// Two people open the same `?live=<id>` URL on the static site and the
// app reads/writes this Worker to keep their calendars in sync. The id
// acts as a bearer secret — anyone with it can read and write, anyone
// without it cannot enumerate.
//
// Free-tier capacity (more than enough for personal use):
//   - 100,000 reads/day
//   - 1,000 writes/day
//   - 1 GB total storage
// At a poll every 5s, two devices = ~35,000 reads/day per shared cal.
// Writes happen on change (debounced) so they're typically dozens/day.
//
// Deploy: see ./README.md.

const ID_PATTERN = /^[A-Za-z0-9_-]{16,40}$/;
const MAX_BYTES = 200_000;                          // ~200 KB cap per calendar
const TTL_SECONDS = 60 * 60 * 24 * 180;             // 180 days (refreshed on every write)

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const id = url.pathname.replace(/^\/+|\/+$/g, "");
    if (!ID_PATTERN.test(id)) return jsonResponse({ error: "Invalid calendar ID" }, 400);

    if (request.method === "GET") {
      const data = await env.CAL_KV.get(id);
      if (data === null) return jsonResponse({ error: "Not found" }, 404);
      return new Response(data, {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    if (request.method === "PUT") {
      const body = await request.text();
      if (body.length > MAX_BYTES) return jsonResponse({ error: "Payload too large" }, 413);
      try {
        const parsed = JSON.parse(body);
        if (parsed === null || typeof parsed !== "object") throw new Error("must be a JSON object");
      } catch (e) {
        return jsonResponse({ error: `Body must be JSON: ${e.message}` }, 400);
      }
      await env.CAL_KV.put(id, body, { expirationTtl: TTL_SECONDS });
      return jsonResponse({ ok: true, ts: Date.now() });
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  },
};
