# AGGREGATE.io

Curated qidiruv. Natijalar faqat `data/links.txt` dagi linklardan keladi. API kalit yoki build kerak emas.

## Tuzilma
- `index.html` va `app.js` — frontend; bosh sahifada tavsiya etilgan manbalar ko'rsatiladi
- `api/search.js` — Vercel serverless qidiruv (`GET /api/search?q=&category=&limit=&offset=`)
- `data/links.txt` — linklar bazasi (bir qator = bir sayt)
- `scripts/check-links.js` — linklarni tekshirish

## Link qo'shish
`data/links.txt` ga yangi qator qo'shing:
```
{ category: "News", source: "BBC", title: "...", description: "...", url: "https://...", wikipediaUrl: "https://en.wikipedia.org/w/index.php?search=..." },
```
Kategoriya faqat: History, Automotive, Real Estate, Electronics, Books, News, Science & Tech. Har bir manba yozuvida manba URL'i va alohida `wikipediaUrl` qidiruv manzili saqlanadi. `Browse all curated sources` tugmasi katalogdagi barcha yozuvlarni 60 tadan sahifalab ko'rsatadi; manba URL'i takrorlangan yozuvlar ham alohida ko'rsatiladi.

`/api/search` bo'sh so'rov bilan barcha manbalarni topadi. `limit` 1–60 oralig'ida sahifa hajmini, `offset` keyingi sahifaning boshlanishini belgilaydi.

## Tekshirish
```
node scripts/check-links.js
```

## Deploy (Vercel)
Papkani GitHub'ga yuklang va Vercel'da import qiling. Framework: Other. Build command bo'sh qoldiring.
Lokal sinash: `npx vercel dev`.
