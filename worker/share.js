// Cloudflare Worker for live calendar sharing.
//
// Stores opaque calendar IDs in a Workers KV namespace as JSON blobs.
// Used by two distinct sharing modes in the static app:
//
//   Live (bidirectional): two devices open ?live=<id> and both can edit.
//     PUT /<id>  → store cal:<id>
//     GET /<id>  → fetch cal:<id>
//
//   Publish (one-way): owner opens ?publish=<writeId> and pushes; viewers
//   open ?view=<readId> and only pull. readId is sha256("view:"+writeId)
//   so the viewer URL can't be used to write. The mapping is kept in KV
//   under view:<readId> = writeId, written automatically on every PUT.
//     PUT /<writeId>        → store cal:<writeId>, refresh view:<readId>
//     GET /view/<readId>    → resolve view:<readId>, return cal:<writeId>
//
// Free-tier capacity (more than enough for personal use):
//   - 100,000 reads/day
//   - 1,000 writes/day
//   - 1 GB total storage
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

// Derives a publishable "viewer" id from the owner's writeId. The same
// function lives on the client; both sides compute it identically so the
// worker never has to trust client-supplied readIds.
async function deriveReadId(writeId) {
  const bytes = new TextEncoder().encode("view:" + writeId);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  const view = new Uint8Array(hash, 0, 12);
  let binary = "";
  for (const b of view) binary += String.fromCharCode(b);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/+|\/+$/g, "");

    // GET /view/<readId> — read-only pointer resolution for published calendars.
    if (path.startsWith("view/") && request.method === "GET") {
      const readId = path.slice("view/".length);
      if (!ID_PATTERN.test(readId)) return jsonResponse({ error: "Invalid viewer id" }, 400);
      const writeId = await env.CAL_KV.get("view:" + readId);
      if (writeId === null) return jsonResponse({ error: "Not found" }, 404);
      const data = await env.CAL_KV.get("cal:" + writeId);
      if (data === null) return jsonResponse({ error: "Not found" }, 404);
      return new Response(data, {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const id = path;
    if (!ID_PATTERN.test(id)) return jsonResponse({ error: "Invalid calendar ID" }, 400);

    if (request.method === "GET") {
      const data = await env.CAL_KV.get("cal:" + id);
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
      // Store the calendar AND refresh the view pointer so a derived
      // viewer URL keeps working (publish mode) and a freshly-derived
      // read URL works for live-mode sessions too.
      await env.CAL_KV.put("cal:" + id, body, { expirationTtl: TTL_SECONDS });
      const readId = await deriveReadId(id);
      await env.CAL_KV.put("view:" + readId, id, { expirationTtl: TTL_SECONDS });
      return jsonResponse({ ok: true, ts: Date.now() });
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  },
};
