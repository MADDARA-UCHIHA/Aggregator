# AGGREGATE.io

Curated qidiruv. Natijalar faqat `data/links.txt` dagi linklardan keladi. API kalit yoki build kerak emas.

## Tuzilma
- `index.html`, `app.js` va `assets/favicon.png` — frontend va brauzer tabidagi logo belgisi
- `api/search.js` — Vercel serverless qidiruv (`GET /api/search?q=&category=&limit=&offset=`)
- `data/links.txt` — linklar bazasi (bir qator = bir sayt)
- `scripts/check-links.js` — linklarni tekshirish

## Link qo'shish
`data/links.txt` ga yangi qator qo'shing:
```
{ category: "News", source: "BBC", title: "...", description: "...", url: "https://..." },
```
Kategoriya faqat: History, Automotive, Real Estate, Electronics, Books, News, Science & Tech. Wikipedia katalogdagi oddiy manba sifatida saqlanadi; boshqa yozuvlardan Wikipedia qidiruv havolalari chiqarilmaydi. `Browse all curated sources` tugmasi katalogdagi barcha yozuvlarni 60 tadan sahifalab ko'rsatadi; manba URL'i takrorlangan yozuvlar ham alohida ko'rsatiladi.

`/api/search` bo'sh so'rov bilan barcha manbalarni topadi. `limit` 1–60 oralig'ida sahifa hajmini, `offset` keyingi sahifaning boshlanishini belgilaydi.

Qidiruv barcha so'zlari mos kelgan natijalarni oldinga chiqaradi; ular topilmasa, mos so'zlar bo'yicha tegishli natijalarni ko'rsatadi. Mashhur qidiruv tugmalari ham katalogdagi mavjud mavzulardan foydalanadi.

## Tekshirish
```
node scripts/check-links.js
```

## Deploy (Vercel)
Papkani GitHub'ga yuklang va Vercel'da import qiling. Framework: Other. Build command bo'sh qoldiring.
Lokal sinash: `npx vercel dev`.
