/**
 * AGGREGATE.io — /api/search
 *
 * GET /api/search?q=<text>&category=<name>&limit=<1-60>&offset=<number>
 *  - Reads data/links.txt (your curated link list), parses each entry,
 *    removes invalid URLs, and returns a page of the best matches.
 *  - Every search term must appear in title, source or description.
 *  - An empty query lists curated sources for the homepage.
 *  - No external API keys required.
 */
const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "..", "data", "links.txt");
const ENTRY_RE =
  /^\s*\{\s*category:\s*"([^"]*)",\s*source:\s*"([^"]*)",\s*title:\s*"([^"]*)",\s*description:\s*"([^"]*)",\s*url:\s*"([^"]*)",\s*wikipediaUrl:\s*"([^"]*)"\s*\},?\s*$/;

const CATEGORIES = ["History", "Automotive", "Real Estate", "Electronics", "Books", "News", "Science & Tech"];
const MAX_RESULTS = 60;
const MAX_QUERY_LENGTH = 120;
const MAX_OFFSET = 10000;

let CACHE = null; // parsed once per warm serverless instance

function normalizeUrl(raw) {
  if (typeof raw !== "string") return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

function loadLinks() {
  if (CACHE) return CACHE;
  const items = [];
  const text = fs.readFileSync(DATA_FILE, "utf8");

  for (const line of text.split(/\r?\n/)) {
    const m = line.match(ENTRY_RE);
    if (!m) continue;

    if (!CATEGORIES.includes(m[1].trim())) continue;
    const url = normalizeUrl(m[5]);
    const wikipediaUrl = normalizeUrl(m[6]);
    if (!url || !wikipediaUrl) continue;
    const wiki = new URL(wikipediaUrl);
    if (wiki.hostname !== "en.wikipedia.org" || wiki.pathname !== "/w/index.php" ||
        wiki.searchParams.get("search") !== m[3].trim()) continue;

    items.push({
      category: m[1].trim(),
      source: m[2].replace(/\s+/g, " ").trim(),
      title: m[3].replace(/\s+/g, " ").trim(),
      description: m[4].replace(/\s+/g, " ").trim(),
      url,
      wikipediaUrl
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
  return scored.map(s => s.item);
}

module.exports = function handler(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const readParam = value => value === undefined ? "" : typeof value === "string" ? value : null;
  const rawQuery = readParam(req.query?.q);
  const rawCategory = readParam(req.query?.category);
  const rawLimit = readParam(req.query?.limit);
  const rawOffset = readParam(req.query?.offset);
  if (rawQuery === null || rawCategory === null || rawLimit === null || rawOffset === null) {
    return res.status(400).json({ error: "Search parameters must be single text values." });
  }

  const q = rawQuery.trim();
  const category = rawCategory.trim();
  if (q.length > MAX_QUERY_LENGTH) {
    return res.status(400).json({ error: `Search terms must be ${MAX_QUERY_LENGTH} characters or fewer.` });
  }
  if (category && !CATEGORIES.includes(category)) {
    return res.status(400).json({ error: "Unknown category." });
  }
  let limit = MAX_RESULTS;
  if (rawLimit) {
    if (!/^\d+$/.test(rawLimit) || Number(rawLimit) < 1 || Number(rawLimit) > MAX_RESULTS) {
      return res.status(400).json({ error: `Limit must be a number from 1 to ${MAX_RESULTS}.` });
    }
    limit = Number(rawLimit);
  }
  let offset = 0;
  if (rawOffset) {
    if (!/^\d+$/.test(rawOffset) || Number(rawOffset) > MAX_OFFSET) {
      return res.status(400).json({ error: `Offset must be a number from 0 to ${MAX_OFFSET}.` });
    }
    offset = Number(rawOffset);
  }

  try {
    const matching = search(q, category || null);
    const results = matching.slice(offset, offset + limit);
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({
      query: q,
      category: category || null,
      count: results.length,
      total: matching.length,
      offset,
      limit,
      results
    });
  } catch (err) {
    console.error("links.txt could not be read:", err);
    return res.status(500).json({ error: "Search data is unavailable right now." });
  }
};
