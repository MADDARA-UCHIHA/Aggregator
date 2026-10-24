# AGGREGATE.io

Curated qidiruv. Natijalar faqat `data/links.txt` dagi linklardan keladi. API kalit yoki build kerak emas.

## Tuzilma
- `index.html` — frontend
- `api/search.js` — Vercel serverless qidiruv (`GET /api/search?q=&category=`)
- `data/links.txt` — linklar bazasi (bir qator = bir sayt)
- `scripts/check-links.js` — linklarni tekshirish

## Link qo'shish
`data/links.txt` ga yangi qator qo'shing:
```
{ category: "News", source: "BBC", title: "...", description: "...", url: "https://..." },
```
Kategoriya faqat: History, Automotive, Real Estate, Electronics, Books, News, Science & Tech.

## Tekshirish
```
node scripts/check-links.js
```

## Deploy (Vercel)
Papkani GitHub'ga yuklang va Vercel'da import qiling. Framework: Other. Build command bo'sh qoldiring.
Lokal sinash: `npx vercel dev`.
