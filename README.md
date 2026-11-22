# Toza

Telegram akkauntini brauzerdan ulaydigan klient. **Premium shart emas**: foydalanuvchi o'z telefoni va kodi bilan kiradi, sessiya faqat uning brauzerida turadi.

Asos: [morethanwords/tweb](https://github.com/morethanwords/tweb) (Telegram Web K), litsenziya **GPL-3.0** (shu repo ham GPL-3.0, manba ochiq).
Web K to'liq ko'chirilmaydi: `build.sh` uni aniq versiyada (`TWEB_REF`) yuklaydi, `overlay/` dagi o'zgartirishlarimizni qo'yadi, nomini «Toza» ga almashtiradi va yig'adi.

## Ko'rinish va ishonch
`brand.mjs` (build vaqtida): Telegram logotipi o'rniga Toza belgisi, «Sign in with Toza», birinchi kirishdan oldin tushuntirish sahifasi (`overlay/toza-intro.html`: nima ulanadi, ma'lumot qayerga ketadi, ochiq kod, ogohlantirish) va asosiy CSS yuklanmasa «Qayta yuklash» oynasi (uslubsiz sahifa o'rniga).

## Toza zaxirasi (o'chirilgan xabarlarni saqlash va tiklash)
Chap menyu → **Toza zaxira**. Yoqilgach brauzer xabarlarni (matn) mahalliy arxivga (IndexedDB) yozadi: yangi, tahrirlangan va o'chirilganlarini. Arxiv **shifrlanib** Sharpa serveriga yuklanadi (nol bilim: shifrlash kaliti serverga berilmaydi). Yangi qurilmada tiklash kodi bilan arxiv tiklanadi.
- Kod: `overlay/src/lib/toza/` (`core.ts` — kalit/shifrlash/arxiv/sinxronlash, tweb'ga bog'liq emas; `hooks.ts`, `ui.ts`, `idb.ts` — tweb bilan bog'lash). tweb'ga o'zgartirish: `patches/0001-toza-menu.patch`.
- Server: Sharpa bot servisidagi `/tb/*` (shifrlangan bo'laklar ombor kanalida saqlanadi).
- Cheklov: faqat Toza ochiq turganda ko'rilgan/kelgan xabarlar saqlanadi. Hozircha faqat matn (media keyingi bosqichda).
- Sinov: `node --experimental-strip-types --test tests/core.test.mjs`.

## Kalitlar
`api_id` / `api_hash` — `my.telegram.org` dan (ilova nomi «Toza»). Repoga YOZILMAYDI: mahalliy yig'ishda `.env.local` (`.env.example` ga qarang), Railway'da Variables. Zaxira serveri: `VITE_TB_URL` (Sharpa bot servisining ochiq manzili; botda `TB_ORIGINS` = Toza manzili).

## Yig'ish
```bash
./build.sh        # natija: dist/
```

## Railway
1. New → GitHub Repo → `ortigaliyev7/toza` (Root Directory kerak emas, Dockerfile repo ildizida).
2. **Variables**: `VITE_API_ID`, `VITE_API_HASH`, `VITE_TB_URL`.
3. **Networking → Generate Domain**. Yig'ish ~3–5 daqiqa.

## Sharpa ichida ochish
Toza Sharpa Mini App ichida to'liq ekranli iframe sifatida ochiladi (kirish ham shu yerda). `FRAME_ANCESTORS` (Railway Variables, bo'sh joy bilan) — Toza'ni qaysi saytlar ichiga joylashtirish mumkinligi; standart: Sharpa botining manzili va Telegram. Sharpa manzili boshqacha bo'lsa — shu o'zgaruvchini yangilang.

## Qoidalar (Telegram API shartlari)
Ommaviy xabar/spam yo'q, foydalanuvchi sessiyasi serverga yuborilmaydi, «Telegram» nomi va belgisi ilova nomi/belgisida ishlatilmaydi (o'z logotipimiz kerak).
