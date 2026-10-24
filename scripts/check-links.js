// Usage: node scripts/check-links.js  — prints how many links are valid per category.
const fs = require("fs");
const path = require("path");
const text = fs.readFileSync(path.join(__dirname, "..", "data", "links.txt"), "utf8");
const re = /^\s*\{\s*category:\s*"([^"]*)",\s*source:\s*"([^"]*)",\s*title:\s*"([^"]*)",\s*description:\s*"([^"]*)",\s*url:\s*"([^"]*)"\s*\},?\s*$/;
const categories = new Set(["History", "Automotive", "Real Estate", "Electronics", "Books", "News", "Science & Tech"]);
const seen = new Set(); const counts = {}; let bad = 0, dup = 0, total = 0, valid = 0;
for (const line of text.split(/\r?\n/)) {
  if (!line.includes("category:")) continue;
  total++;
  const m = line.match(re);
  if (!m) { bad++; console.log("Format xato:", line.trim().slice(0, 100)); continue; }
  if (!categories.has(m[1])) { bad++; console.log("Kategoriya xato:", m[1]); continue; }
  let url;
  try { url = new URL(m[5]); } catch { bad++; console.log("URL xato:", m[5]); continue; }
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password) {
    bad++; console.log("Xavfsiz bo'lmagan URL:", m[5]); continue;
  }
  valid++;
  counts[m[1]] = (counts[m[1]] || 0) + 1;
  const key = m[5].replace(/\/+$/, "").toLowerCase();
  if (seen.has(key)) { dup++; continue; }
  seen.add(key);
}
console.log("Jami qatorlar:", total, "| Yaroqli yozuv:", valid, "| Takroriy manba URL:", dup, "| Xato:", bad, "| Yagona manba URL:", seen.size);
console.table(counts);
if (bad > 0) process.exitCode = 1;
