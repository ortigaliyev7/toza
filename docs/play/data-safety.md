# Data safety (Play Console → App content → Data safety)

| Savol | Javob |
|---|---|
| Ma'lumot to'playdimi yoki ulashadimi? | **Ha** (Premium va zaxira yoqilganda) |
| Uzatishda shifrlanadimi? | **Ha** (HTTPS, Telegram MTProto) |
| Foydalanuvchi o'chirishni so'ray oladimi? | **Ha** → `https://<sayt>/delete.html` |
| Uchinchi tomonga ulashiladimi? | **Yo'q** (Telegram'ga yuborish — foydalanuvchining o'zi so'ragan asosiy vazifa, «ulashish» hisoblanmaydi) |

**To'planadigan turlar** (hammasi *ixtiyoriy*, maqsad: **App functionality**; reklama/analitika — yo'q):
- **Messages → Other in-app messages**: Toza Premium (Sharpa boti, Telegram Business) yoqilganda shaxsiy chatlar xabarlari serverda saqlanadi. Shifrlangan zaxira ham shu yerga (u serverda o'qib bo'lmaydigan shaklda).
- **Photos and videos / Audio**: Premium «To'liq»da rasm, dumaloq video, ovozli xabar.
- **Personal info → User IDs**: Telegram ID (obunani bog'lash uchun).
- **Financial info → Purchase history**: Google Play xarid tokeni (obunani tekshirish).

**To'planmaydi**: joylashuv, kontaktlar ro'yxati (serverga), qurilma ID, brauzer tarixi, analitika, crash log.

Telefon raqam va kirish kodi faqat Telegram'ga ketadi — bizga emas, shuning uchun «Phone number» belgilanmaydi.
