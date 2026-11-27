# Siz qiladigan ishlar (oddiy tilda)

Bularni faqat siz qila olasiz: akkaunt, pul va kalitlar sizning nomingizda bo'ladi.

## 1. Google Play Console akkaunti (bir marta, 25 $)
1. https://play.google.com/console → Google akkaunt bilan kiring → **Shaxsiy** (Personal) akkaunt.
2. 25 $ to'lang (bir marta), pasport/ID bilan shaxsingizni tasdiqlang. 1–3 kun.
3. **Muhim**: yangi shaxsiy akkauntda ilovani chiqarishdan oldin **12 kishi 14 kun** yopiq sinovda (Closed testing) ishlatishi shart. Tanishlaringizning Gmail manzillarini tayyorlab qo'ying.

## 2. To'lov profili (pul olish uchun)
Play Console → **Settings → Payments profile** → bank karta/hisob (Visa/Mastercard, USD qabul qiladigan). Soliq ma'lumotlari (W-8BEN, O'zbekiston). Google har oyda to'laydi.
- Google ulushi: obunadan **15%** (yiliga 1 mln $ gacha). Qolgan 85% sizniki.

## 3. Ilova yaratish
Play Console → **Create app** → nom: `Toza`, til: o'zbek, turi: App, bepul (ichida obuna bor). Paket nomi birinchi yuklashda `uz.toza.app` bo'ladi — keyin o'zgarmaydi.

## 4. Imzo kaliti (bir marta)
Kompyuterda (Java o'rnatilgan bo'lsa):
```
keytool -genkeypair -v -keystore toza-upload.jks -alias toza -keyalg RSA -keysize 2048 -validity 10000
```
Parolni yozib qo'ying. **Faylni yo'qotmang va hech kimga bermang.** Keyin GitHub → repo → Settings → Secrets and variables → Actions:
- Secrets: `TOZA_KEYSTORE_BASE64` (fayl base64: `base64 -w0 toza-upload.jks`), `TOZA_KEYSTORE_PASSWORD`, `TOZA_KEY_ALIAS` (= toza), `TOZA_KEY_PASSWORD`.
- Variables: `TOZA_HOST` = Toza sayti manzili (masalan `toza-production.up.railway.app`, https:// siz).

## 5. Ilovani yig'ish
GitHub → Actions → **Android ilova** → Run workflow. 5–8 daqiqada `.aab` fayl tayyor (Artifacts). Play Console → Testing → Closed testing → yangi reliz → shu `.aab` ni yuklang.

## 6. Sayt bilan bog'lash (manzil satri chiqmasligi uchun)
Play Console → **Test and release → App integrity → App signing** → «SHA-256 certificate fingerprint» ni nusxalang (ikkala kalitniki: App signing key va Upload key).
Railway → Toza → Variables → `ANDROID_SHA256` = ikkalasi, bo'sh joy bilan. Redeploy. Tekshirish: `https://<sayt>/.well-known/assetlinks.json`.

## 7. Obuna mahsulotlari
Play Console → **Monetize → Products → Subscriptions** → ikkita:
| Product ID | Nomi | Base plan |
|---|---|---|
| `toza_oddiy` | Toza Premium Oddiy | oylik, avto-yangilanadi |
| `toza_toliq` | Toza Premium To'liq | oylik, avto-yangilanadi |
Narxni o'zingiz qo'yasiz (Sharpa'dagi narxga yaqin). Ixtiyoriy: 3 kunlik bepul sinov (free trial).

## 8. Sharpa serveriga ruxsat (obunani tekshirish uchun)
1. Google Cloud Console → yangi loyiha → **Google Play Android Developer API** ni yoqing → Service account → JSON kalit yuklab oling.
2. Play Console → **Users and permissions** → shu service account email'ini qo'shing → «View financial data» va «Manage orders and subscriptions» ruxsati.
3. JSON kalitni Railway → Sharpa → Variables → `GOOGLE_PLAY_SA_JSON` ga qo'ying. (Sharpa'dagi kod: `sharpa-play-api.md`.)

## 9. Do'kon sahifasi
- Matnlar: `listing-uz.md`, `listing-ru.md`, `listing-en.md` dan nusxa.
- Grafika: `grafika/icon-512.png`, `grafika/feature-1024x500.png`; telefon skrinshotlari (kamida 2 ta) — loyiha papkasidagi `toza/*.png` dan tanlang (Telegram logotipi ko'rinmasin).
- **Privacy policy URL**: `https://<sayt>/privacy.html`. **Data deletion URL**: `https://<sayt>/delete.html`.
- **Data safety**: `data-safety.md` dagi javoblar.
- Content rating so'rovnomasi: aloqa ilovasi, foydalanuvchilar o'zaro yozishadi → odatda 12+/Teen.
- Target audience: 18+ (yoki 13+), bolalar uchun emas.
- Sahifalardagi `SUPPORT_EMAIL` ni o'z yordam pochtangizga almashtiring (`site/*.html`).

## 10. Telegram
my.telegram.org → API development tools: ilova nomi «Toza», platforma Android. Hozirgi `VITE_API_ID` ishlatilaveradi.
