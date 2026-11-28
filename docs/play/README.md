# Toza → Google Play

Toza Android ilovasi — **Trusted Web Activity** (TWA): Toza sayti Chrome orqali to'liq ekranda, manzil satrisiz ochiladi. Kod bitta: saytga kiritilgan har bir yangilanish ilovada ham darhol chiqadi, ilovani qayta yuklash shart emas (faqat `android/` o'zgarsa).

| Qism | Joyi |
|---|---|
| Android loyiha | `android/` (paket `uz.toza.app`, targetSdk 36) |
| Yig'ish | GitHub Actions → «Android ilova» (`.github/workflows/android.yml`) → `.aab` |
| Sayt ↔ ilova bog'lash | `/.well-known/assetlinks.json` (Railway `ANDROID_SHA256`) |
| Maxfiylik / shartlar / o'chirish | `/privacy.html`, `/terms.html`, `/delete.html` (`site/`) |
| Obuna | Google Play Billing, `overlay/src/lib/toza/play.ts` |
| Do'kon matnlari | `listing-uz.md`, `listing-ru.md`, `listing-en.md` |
| Data safety javoblari | `data-safety.md` |
| Sharpa serveriga kerak | `sharpa-play-api.md` |
| Grafika | `grafika/icon-512.png`, `grafika/feature-1024x500.png` |

## Qoidalar (nima uchun ba'zi narsalar o'chirildi)

**Telegram API shartlari** (core.telegram.org/api/terms):
- 1.4: «ko'rinmas rejim» («o'qildi»ni yashirish), «yozmoqda»ni yashirish va o'zi yo'qoladigan kontentni saqlab qolish **taqiqlangan**. Buzilsa Telegram 10 kun ichida api_id'ni o'chiradi va do'kondan olib tashlatadi. Shuning uchun **qoidalar rejimi** (`play.ts → isStrict`): ko'rinmas rejim (o'qildi, yozmoqda, offlayn, yashirin hikoya), bir martalik media saqlash va avto-o'chiriladigan xabarlarni ushlash o'chiq va menyuda ko'rinmaydi. Ilovada doim. Saytda `STRICT_WEB = false` (egasining qarori, 2026-11-28): saytda ko'rinmas rejim qoladi. Xavf: api_id bitta, Telegram saytdagi buzilishni topsa, ilova ham to'xtaydi.
- 2.3–2.4: nomda «Telegram» yo'q, Telegram logotipi yo'q (o'z «T» belgimiz).
- 2.2: do'kon tavsifida «norasmiy Telegram klienti» ekani aniq yozilgan.
- 3.2: barcha pul topish usullari tavsifda yozilgan (faqat obuna).
- 3.3: kanallardagi rasmiy homiylik xabarlari (sponsored) — Web K'ning o'zida bor, o'chirilmagan.

**Google Play**:
- Raqamli obuna faqat **Google Play Billing** orqali. Ilovada Sharpa botidagi to'lovga havola/tugma yo'q (`openPremium` Play'da ishlamaydi). Saytda (brauzerda) Sharpa to'lovi qoladi — Play buni taqiqlamaydi.
- Obuna oynasida narx, davr, avtomatik yangilanish va bekor qilish yo'li ko'rsatiladi; «Xaridni tiklash» va «Obunani boshqarish» tugmalari bor.
- Maxfiylik siyosati, ma'lumot o'chirish sahifasi, Data safety formasi, targetSdk 36.

Egasi bajaradigan qadamlar: [QADAMLAR.md](QADAMLAR.md).
