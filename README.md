# Toza

Telegram akkauntini brauzerdan ulaydigan klient. **Premium shart emas**: foydalanuvchi o'z telefoni va kodi bilan kiradi, sessiya faqat uning brauzerida turadi.

Asos: [morethanwords/tweb](https://github.com/morethanwords/tweb) (Telegram Web K), litsenziya **GPL-3.0** (shu repo ham GPL-3.0, manba ochiq).
Web K to'liq ko'chirilmaydi: `build.sh` uni aniq versiyada (`TWEB_REF`) yuklaydi, `overlay/` dagi o'zgartirishlarimizni qo'yadi, nomini «Toza» ga almashtiradi va yig'adi.

## Kalitlar
`api_id` / `api_hash` — `my.telegram.org` dan (ilova nomi «Toza»). Repoga YOZILMAYDI: mahalliy yig'ishda `.env.local` (`.env.example` ga qarang), Railway'da Variables.

## Yig'ish
```bash
./build.sh        # natija: dist/
```

## Railway
1. New → GitHub Repo → `ortigaliyev7/toza` (Root Directory kerak emas, Dockerfile repo ildizida).
2. **Variables**: `VITE_API_ID`, `VITE_API_HASH`.
3. **Networking → Generate Domain**. Yig'ish ~3–5 daqiqa.

## Qoidalar (Telegram API shartlari)
Ommaviy xabar/spam yo'q, foydalanuvchi sessiyasi serverga yuborilmaydi, «Telegram» nomi va belgisi ilova nomi/belgisida ishlatilmaydi (o'z logotipimiz kerak).
