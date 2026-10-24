/**
 * AGGREGATE.io — /api/search
 *
 * GET /api/search?q=<text>&category=<name>&limit=<1-60>&offset=<number>
 *  - Reads data/links.txt (your curated link list), parses each entry,
 *    removes invalid URLs, and returns a page of the best matches.
 *  - Exact all-term matches are ranked first, with relevant partial matches as a fallback.
 *  - An empty query lists curated sources for the homepage.
 *  - No external API keys required.
 */
const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "..", "data", "links.txt");
const ENTRY_RE =
  /^\s*\{\s*category:\s*"([^"]*)",\s*source:\s*"([^"]*)",\s*title:\s*"([^"]*)",\s*description:\s*"([^"]*)",\s*url:\s*"([^"]*)"\s*\},?\s*$/;

const CATEGORIES = ["History", "Automotive", "Real Estate", "Electronics", "Books", "News", "Science & Tech"];
const MAX_RESULTS = 60;
const MAX_QUERY_LENGTH = 120;
const MAX_OFFSET = 10000;
const MAX_WIKIPEDIA_OFFSET = 500;

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
    if (!url) continue;

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

function normalizeSearchText(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function searchTokens(value) {
  const tokens = new Set(normalizeSearchText(value).split(/\s+/).filter(Boolean));
  for (const token of tokens) {
    if (token.length > 4 && token.endsWith("s") && !token.endsWith("ss")) {
      tokens.add(token.slice(0, -1));
    }
  }
  return tokens;
}

function search(query, category) {
  const normalizedQuery = normalizeSearchText(query);
  const terms = [...new Set(normalizedQuery.split(/\s+/).filter(Boolean))];
  const items = loadLinks().map(item => ({
    item,
    title: normalizeSearchText(item.title),
    source: normalizeSearchText(item.source),
    description: normalizeSearchText(item.description),
    titleTokens: searchTokens(item.title),
    sourceTokens: searchTokens(item.source),
    descriptionTokens: searchTokens(item.description)
  }));
  const termFrequency = new Map(terms.map(term => [term, 0]));
  for (const entry of items) {
    const words = new Set([
      ...entry.titleTokens,
      ...entry.sourceTokens,
      ...entry.descriptionTokens
    ]);
    for (const term of terms) {
      if (words.has(term)) termFrequency.set(term, termFrequency.get(term) + 1);
    }
  }
  const termWeight = new Map(terms.map(term => [
    term,
    Math.log((items.length + 1) / (termFrequency.get(term) + 1)) + 1
  ]));
  const scored = [];
  for (const entry of items) {
    const { item } = entry;
    if (category && item.category !== category) continue;

    if (terms.length === 0) {
      scored.push({ item, score: 0 });
      continue;
    }

    let score = 0;
    let matchedTerms = 0;

    for (const term of terms) {
      if (entry.titleTokens.has(term)) score += termWeight.get(term) * 3;
      else if (entry.sourceTokens.has(term)) score += termWeight.get(term) * 2;
      else if (entry.descriptionTokens.has(term)) score += termWeight.get(term);
      else continue;
      matchedTerms++;
    }
    if (matchedTerms > 0) {
      if (entry.title.includes(normalizedQuery)) score += 5 + terms.reduce((sum, term) => sum + termWeight.get(term), 0);
      scored.push({ item, score, matchedTerms });
    }
  }

  scored.sort((a, b) =>
    b.score - a.score ||
    b.matchedTerms - a.matchedTerms ||
    a.item.title.localeCompare(b.item.title)
  );
  const exactMatches = scored.filter(result => result.matchedTerms === terms.length);
  return (exactMatches.length ? exactMatches : scored).map(result => result.item);
}

function stripHtml(value) {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&#039;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ");
}

async function searchWikipedia(query, offset, limit) {
  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: query,
    srlimit: String(limit),
    sroffset: String(Math.min(offset, MAX_WIKIPEDIA_OFFSET)),
    format: "json",
    utf8: "1"
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  let response;
  try {
    response = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "AGGREGATE.io/1.0 (Wikipedia search)"
      }
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new Error(`Wikipedia returned HTTP ${response.status}.`);

  const data = await response.json();
  const pages = data?.query?.search;
  const totalHits = data?.query?.searchinfo?.totalhits;
  if (!Array.isArray(pages) || !Number.isSafeInteger(totalHits) || totalHits < 0) {
    throw new Error("Wikipedia returned invalid search results.");
  }

  const total = Math.min(totalHits, MAX_WIKIPEDIA_OFFSET);
  const pageOffset = Math.min(offset, total);
  return {
    total,
    offset: pageOffset,
    results: pages
      .filter(page => typeof page.title === "string" && typeof page.snippet === "string")
      .map(page => ({
        category: "Science & Tech",
        source: "Wikipedia",
        title: page.title,
        description: stripHtml(page.snippet),
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`
      }))
  };
}

module.exports = async function handler(req, res) {
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

  let matching;
  try {
    matching = search(q, category || null);
  } catch (err) {
    console.error("links.txt could not be read:", err);
    return res.status(500).json({ error: "Search data is unavailable right now." });
  }

  if (q && matching.length === 0 && (!category || category === "Science & Tech")) {
    try {
      const wikipedia = await searchWikipedia(q, offset, limit);
      res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
      return res.status(200).json({
        query: q,
        category: category || null,
        count: wikipedia.results.length,
        total: wikipedia.total,
        offset: wikipedia.offset,
        limit,
        results: wikipedia.results
      });
    } catch (err) {
      console.error("Wikipedia search failed:", err);
      return res.status(502).json({ error: "Wikipedia search is temporarily unavailable. Please try again." });
    }
  }

  const pageOffset = Math.min(offset, matching.length);
  const results = matching.slice(pageOffset, pageOffset + limit);
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
  return res.status(200).json({
    query: q,
    category: category || null,
    count: results.length,
    total: matching.length,
    offset: pageOffset,
    limit,
    results
  });
};
