// SEC: server-side HTML allowlist for stored rich text (letters).
// Client DOMPurify is defense-in-depth; the DB must never hold active content,
// so any present/future renderer is safe by default. No deps — regex allowlist
// mirroring the Tiptap output tags (p/strong/em/headings/lists/blockquote/code).

const BLOCKED_TAGS = /<\/?\s*(script|iframe|object|embed|form|input|button|select|textarea|link|meta|base|svg|math|frame|frameset|video|audio|img|picture|source|canvas|style)\b[^>]*>/gi;
const EVENT_ATTRS = /\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const DANGEROUS_HREF = /\s+(href|src|xlink:href)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi;
const SAFE_SCHEMES = /^(https?:|mailto:|#|\/|[^a-zA-Z])/;

function cleanHref(match: string, _attr: string, q1?: string, v1?: string, q2?: string, v2?: string, v3?: string): string {
  const raw = (v1 ?? v2 ?? v3 ?? "").trim();
  if (!SAFE_SCHEMES.test(raw)) return "";
  const q = q1 ?? q2 ?? '"';
  const safe = raw.replace(/"/g, "&quot;");
  return ` href=${q}${safe}${q}`;
}

export function sanitizeStoredHtml(input: string): string {
  if (!input) return input;
  return input
    .replace(BLOCKED_TAGS, "")
    .replace(EVENT_ATTRS, "")
    .replace(DANGEROUS_HREF, cleanHref as (...args: string[]) => string)
    // SEC: strip style attrs server-side (CSS expression/URL vectors; client DOMPurify keeps them).
    .replace(/\s+style\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
}
