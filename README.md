# Toza

Telegram akkauntini brauzerdan ulaydigan klient. **Premium shart emas**: foydalanuvchi o'z telefoni va kodi bilan kiradi, sessiya faqat uning brauzerida turadi.

Asos: [morethanwords/tweb](https://github.com/morethanwords/tweb) (Telegram Web K), litsenziya **GPL-3.0** (shu repo ham GPL-3.0, manba ochiq).
Web K to'liq ko'chirilmaydi: `build.sh` uni aniq versiyada (`TWEB_REF`) yuklaydi, `overlay/` dagi o'zgartirishlarimizni qo'yadi, nomini «Toza» ga almashtiradi va yig'adi.

## Ko'rinish va ishonch
`brand.mjs` (build vaqtida): Telegram logotipi o'rniga Toza belgisi, «Sign in with Toza», birinchi kirishdan oldin qisqa tushuntirish (`overlay/toza-intro.html`: nima ulanadi, ma'lumot qayerga ketadi, ogohlantirish; Sharpa ichida ochilganda ko'rsatilmaydi, kirish darrov boshlanadi) va asosiy CSS yuklanmasa «Qayta yuklash» oynasi (uslubsiz sahifa o'rniga).

## Toza zaxirasi (o'chirilgan xabarlarni saqlash va tiklash)
Chap menyu → **Toza zaxira**. Yoqilgach brauzer xabarlarni (matn) mahalliy arxivga (IndexedDB) yozadi: yangi, tahrirlangan va o'chirilganlarini. Arxiv **shifrlanib** Sharpa serveriga yuklanadi (nol bilim: shifrlash kaliti serverga berilmaydi). Yangi qurilmada tiklash kodi bilan arxiv tiklanadi.
- Kod: `overlay/src/lib/toza/` (`core.ts` — kalit/shifrlash/arxiv/sinxronlash, tweb'ga bog'liq emas; `hooks.ts`, `ui.ts`, `idb.ts` — tweb bilan bog'lash). tweb'ga o'zgartirish: `patches/0001-toza-menu.patch`.
- Server: Sharpa bot servisidagi `/tb/*` (shifrlangan bo'laklar ombor kanalida saqlanadi).
- Fayllar (Sharpa obunasida): rasm, video, dumaloq video, ovoz, GIF, musiqa, hujjat (nomi bilan), stiker (.webp/.webm; animatsiyali .tgs saqlanmaydi). Chegaralar: `core.ts → MEDIA_MAX_BYTES`.
- Bo'shliqni to'ldirish: Toza ochilganda, yopiq paytda kelgan xabarlar shaxsiy chatlar tarixidan olinib arxivga yoziladi (`hooks.ts → backfill`, 40 tagacha chat). Yopiq paytda kelib, o'sha zahoti o'chirilgan xabarni qaytarib bo'lmaydi.
- Sinov: `node --experimental-strip-types --test tests/core.test.mjs`.

## Google Play ilovasi
`android/` — Trusted Web Activity (paket `uz.toza.app`), obuna Google Play Billing orqali (`overlay/src/lib/toza/play.ts`). Qoidalar rejimi (`isStrict`): Telegram API shartlari 1.4 bo'yicha ko'rinmas rejim va bir martalik media o'chiq (faqat Play ilovasida; saytda `STRICT_WEB = false`). Hujjatlar va egasi bajaradigan qadamlar: `docs/play/` (`QADAMLAR.md`). Railway: `ANDROID_SHA256` (assetlinks). Sahifalar: `/privacy.html`, `/terms.html`, `/delete.html` (`site/`).

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

## Qo'shimcha imkoniyatlar (Toza zaxira oynasida)
Hammasi **brauzer ichida** ishlaydi, xabar matni serverga yuborilmaydi (zaxira nol bilim bo'lib qoladi):
- **Qidiruv**: saqlangan matn va tahrir tarixidan; chat, «faqat o'chirilgan» filtri (`tools-core.ts → searchArchive`).
- **Statistika**: jami, chat bo'yicha joy, oxirgi 30 kun, eng faol soat (`computeStats`).
- **Eksport**: chatni `.txt` yoki to'liq `.html` (rasm/ovoz/video ichiga joylangan; matn HTML-xavfsiz).
- **Shablonlar**: tezkor javoblar (localStorage), yozish maydoniga qo'yish; rejalashtirib yuborish — Telegram'ning o'z imkoniyati.
- **Qulf (PIN)**: `toza-intro.html` ichida (PBKDF2-SHA256 150 000 aylanish); Toza ochilganda va fonda turgach so'raydi. Xabarlarni shifrlamaydi.
- **Chatda o'chirilgan xabarlar o'z joyida** (`ghost.ts`): bubblelar orasiga «ko'lanka» blok (matn, ovoz/rasm/video, oldingi tahrirlar) qo'yiladi; qo'shimcha: ochiq chatda «O'chirilgan: N» belgisi (bosilsa shu chatning ro'yxati).

Qoidalar: tweb GPL-3.0 (kod ochiq qoladi), Telegram brendi/logotipidan foydalanilmaydi, spam/avtomatlashtirilgan suiiste'mol yo'q, tweb pin qilingan commit'da, o'zgartirishlar kichik (`overlay/` + `patches/`). Sinov: `node --experimental-strip-types --test tests/core.test.mjs`.

## Toza sozlamalari
Chap menyu → **Toza sozlamalari** (`overlay/src/lib/toza/settings.ts`, sozlamalar `prefs.ts`, hammasi localStorage'da):
- **Ko'rinmas rejim**: «o'qildi» (va ovoz «tinglandi») yubormaslik, «yozmoqda» yubormaslik, doim «offlayn», hikoyani yashirin ko'rish. tweb ishchisida (`patches/0002-toza-ghost.patch`, bayroqlar `flags.ts`): o'qish faqat mahalliy bo'ladi; chatdagi «👁 O'qildi yuborish» tugmasi yoki «O'qilgan deb belgilash» serverga yuboradi.
- **Bir martalik media**: ixtiyoriy (standart o'chiq), zaxira + obuna bilan saqlanadi, ro'yxati shu oynada.
- **Hikoyalar**: kontaktlarning hozirgi hikoyalarini rasm/video qilib yuklab olish.
- **Kalit so'zlar**: belgilangan so'z chiqsa ekranda/tizim bildirishnomasi bilan xabar (`tools-core.ts → matchKeyword`).
- **Lotin ↔ Kirill**: o'girgich va yozish maydonida Alt+K / Alt+L (`translit.ts`).
- Tarjima, bir nechta akkaunt (3 tagacha), chat papkalari, shrift o'lchami va fon — tweb'ning o'zida bor, oyna ularga yo'l ko'rsatadi.
- Eksport: .txt, .html, PDF (chop etish oynasi orqali), JSON (bitta yoki hamma chatlar).

## Toza profilim
Chap menyu → **Toza profilim**: Toza holati (zaxira, PIN qulf, xabar berish, hajm), shaxsiy status/belgi/rang mavzusi (faqat shu brauzerda), chatlar boshqaruvi va xavfsizlik tarixi. Sharpa bilan bog'liq emas.

## Avtomatik yangilanish
Har yig'ishda `build.sh` versiya belgilaydi (`VITE_TOZA_BUILD`: Railway commit SHA yoki vaqt) va `dist/toza-version.txt` yozadi. Ochiq Toza har 5 daqiqada va ekranga qaytganda shu faylni tekshiradi (`overlay/src/lib/toza/update.ts`):
- Toza fonda bo'lsa: darrov qayta yuklanadi. Ekranda bo'lsa: 10 soniyalik ogohlantirish («Hozir» / «Keyinroq»). Foydalanuvchi yozayotgan, oyna ochiq yoki ovoz/video ijro bo'layotgan bo'lsa kutadi.
- Qayta ochilgach bir marta **«Toza yangilandi»** oynasi chiqadi. Matni `toza-changelog.json` ning birinchi yozuvidan olinadi: **har deploydan oldin shu faylga yangi yozuv qo'shing** (eng yangisi tepada).
