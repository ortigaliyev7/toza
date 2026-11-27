# Sharpa serveriga: `POST /tb/play` (Google Play obunasini tekshirish)

Toza ilovasi (Play) obuna sotib olgach yoki «Xaridni tiklash»da shu so'rovni yuboradi (`overlay/src/lib/toza/play.ts`):

```
POST /tb/play
X-TB-Dev: <qurilma tokeni, /tb/login dan>
Content-Type: application/json
{"token": "<purchaseToken>", "sku": "toza_oddiy" | "toza_toliq", "pkg": "uz.toza.app"}
```

Server qiladi:
1. `X-TB-Dev` → Telegram foydalanuvchi ID (hozirgi `/tb/biz` dagidek). Yo'q/noto'g'ri → 403.
2. Google Play Developer API: `GET https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{pkg}/purchases/subscriptionsv2/tokens/{token}`
   (service account, scope `https://www.googleapis.com/auth/androidpublisher`, kalit `GOOGLE_PLAY_SA_JSON`).
3. `subscriptionState` ∈ {`SUBSCRIPTION_STATE_ACTIVE`, `SUBSCRIPTION_STATE_IN_GRACE_PERIOD`} va `lineItems[].productId == sku` bo'lsa:
   - tarif: `toza_oddiy` → Oddiy, `toza_toliq` → To'liq; muddat: `lineItems[].expiryTime`.
   - shu foydalanuvchining Sharpa obunasini shu muddatgacha yoqadi (`/tb/biz` javobida `paid`, `full`, `plans` shunga qarab chiqadi).
   - `acknowledgementState == ACKNOWLEDGEMENT_STATE_PENDING` bo'lsa: `POST .../purchases/subscriptions/{sku}/tokens/{token}:acknowledge` (**3 kun ichida tasdiqlanmasa Google pulni qaytaradi**).
   - Token → Telegram ID bog'lanishini saqlaydi (bitta token bitta akkauntga; boshqa akkaunt shu tokenni yuborsa → 409).
4. Javob: `200 {"ok":true,"paid":true,"full":bool,"until":unix}`; obuna faol emas → `402`; token noto'g'ri → `400`.

Keyin (tavsiya): **Real-time developer notifications** (Pub/Sub) — yangilanish, bekor qilish, qaytarish (`SUBSCRIPTION_RENEWED`, `CANCELED`, `EXPIRED`, `REVOKED`) kelganda muddatni yangilash. Bo'lmasa, `/tb/biz` har chaqirilganda muddati o'tgan Play obunalarini qayta tekshirish yetadi.

Maxfiylik siyosatiga mos bo'lishi uchun: Business orqali saqlangan xabarlar bot uzilgandan keyin **30 kun ichida** o'chirilsin.
