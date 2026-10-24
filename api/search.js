/**
 * AGGREGATE.io — /api/search
 *
 * GET /api/search?q=<text>&category=<name>
 *  - Reads data/links.txt (your curated link list), parses each entry,
 *    removes invalid and duplicate URLs, and returns the best matches.
 *  - Every search term must appear in title, source or description.
 *  - No external API keys required.
 */
const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "..", "data", "links.txt");
const ENTRY_RE =
  /\{\s*category:\s*"([^"]*)",\s*source:\s*"([^"]*)",\s*title:\s*"([^"]*)",\s*description:\s*"([^"]*)",\s*url:\s*"([^"]*)"\s*\}/;

const CATEGORIES = ["History", "Automotive", "Real Estate", "Electronics", "Books", "News", "Science & Tech"];
const MAX_RESULTS = 60;
const MAX_QUERY_LENGTH = 120;

let CACHE = null; // parsed once per warm serverless instance

function normalizeUrl(raw) {
  let s = String(raw || "").trim().replace(/^(https?):(?!\/\/)/i, "$1://");
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

function loadLinks() {
  if (CACHE) return CACHE;
  const seen = new Set();
  const items = [];
  const text = fs.readFileSync(DATA_FILE, "utf8");

  for (const line of text.split(/\r?\n/)) {
    const m = line.match(ENTRY_RE);
    if (!m) continue;

    const url = normalizeUrl(m[5]);
    if (!url) continue;

    const key = url.replace(/\/+$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    items.push({
      category: m[1].trim(),
      source: m[2].replace(/\s+/g, " ").trim(),
      title: m[3].replace(/\s+/g, " ").trim(),
      description: m[4].replace(/\s+/g, " ").trim(),
      url
    });
  }
  CACHE = items;
  return items;
}

function search(query, category) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const scored = [];

  for (const item of loadLinks()) {
    if (category && item.category !== category) continue;

    if (terms.length === 0) {
      scored.push({ item, score: 0 });
      continue;
    }

    const title = item.title.toLowerCase();
    const source = item.source.toLowerCase();
    const desc = item.description.toLowerCase();
    let score = 0;
    let matchedAll = true;

    for (const term of terms) {
      if (title.includes(term)) score += 3;
      else if (source.includes(term)) score += 2;
      else if (desc.includes(term)) score += 1;
      else { matchedAll = false; break; }
    }
    if (matchedAll) scored.push({ item, score });
  }

  scored.sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title));
  return scored.slice(0, MAX_RESULTS).map(s => s.item);
}

module.exports = function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const q = String(req.query?.q || "").trim().slice(0, MAX_QUERY_LENGTH);
  const category = String(req.query?.category || "").trim();

  if (category && !CATEGORIES.includes(category)) {
    return res.status(400).json({ error: "Unknown category." });
  }
  if (!q && !category) {
    return res.status(400).json({ error: "Enter a search term or choose a category." });
  }

  try {
    const results = search(q, category || null);
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ query: q, category: category || null, count: results.length, results });
  } catch (err) {
    console.error("links.txt could not be read:", err);
    return res.status(500).json({ error: "Search data is unavailable right now." });
  }
};
