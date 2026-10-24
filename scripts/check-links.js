// Usage: node scripts/check-links.js  — prints how many links are valid per category.
const fs = require("fs");
const path = require("path");
const text = fs.readFileSync(path.join(__dirname, "..", "data", "links.txt"), "utf8");
const re = /\{\s*category:\s*"([^"]*)",\s*source:\s*"([^"]*)",\s*title:\s*"([^"]*)",\s*description:\s*"([^"]*)",\s*url:\s*"([^"]*)"\s*\}/;
const seen = new Set(); const counts = {}; let bad = 0, dup = 0, total = 0;
for (const line of text.split(/\r?\n/)) {
  if (!line.includes("category:")) continue;
  total++;
  const m = line.match(re);
  if (!m) { bad++; console.log("Format xato:", line.trim().slice(0, 100)); continue; }
  try { new URL(m[5]); } catch { bad++; console.log("URL xato:", m[5]); continue; }
  const key = m[5].replace(/\/+$/, "").toLowerCase();
  if (seen.has(key)) { dup++; continue; }
  seen.add(key);
  counts[m[1]] = (counts[m[1]] || 0) + 1;
}
console.log("Jami qatorlar:", total, "| Takroriy:", dup, "| Xato:", bad, "| Yaroqli unikal:", seen.size);
console.table(counts);
