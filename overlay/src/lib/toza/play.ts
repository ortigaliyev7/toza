// Google Play ilovasi (Android, Trusted Web Activity) va qoidalar rejimi.
//  - Ilova Toza'ni `/?tz_app=play` bilan ochadi (android/ → launchUrl). Belgi sessionStorage'da turadi (sahifa qayta yuklansa ham).
//  - Qoidalar rejimi (strict): Telegram API shartlari 1.4 «ko'rinmas rejim», «yozmoqda»ni yashirish va bir martalik mediani
//    saqlashni taqiqlaydi. Bu rejimda ular o'chiq va menyuda ko'rinmaydi. Play ilovasida doim yoqilgan.
//  - To'lov: Play ilovasida faqat Google Play Billing (Digital Goods API + Payment Request). Sharpa botidagi to'lovga
//    yo'naltirish YO'Q (Play «Payments» siyosati). Xarid tokeni Sharpa serveriga (/tb/play) yuboriladi, server Google'dan
//    tekshiradi, tasdiqlaydi (acknowledge) va obunani yoqadi.
const LS_STRICT = 'toza_strict', SS_PLAY = 'toza_play';
const PLAY_BILLING = 'https://play.google.com/billing';
/** Android paket nomi (android/app/build.gradle → applicationId bilan bir xil). */
export const PKG = 'uz.toza.app';

/** Veb-saytda ham qoidalar rejimi (Telegram api_id bitta: veb buzsa, ilova ham yopiladi). */
export const STRICT_WEB = true;

/** Google Play ilovasi ichida ochilganmi. */
export function isPlayApp(): boolean {
  try {
    if(/[?&]tz_app=play\b/.test(location.search) || document.referrer.startsWith('android-app://')) sessionStorage.setItem(SS_PLAY, '1');
    return sessionStorage.getItem(SS_PLAY) === '1';
  } catch{ return /[?&]tz_app=play\b/.test(location.search); }
}

/** Qoidalar rejimi: ko'rinmas rejim va bir martalik media o'chiq. */
export function isStrict(): boolean {
  if(STRICT_WEB || isPlayApp()) return true;
  try { return localStorage.getItem(LS_STRICT) === '1'; } catch{ return false; }
}

/** Play obunalari (Play Console → Monetize → Subscriptions da shu ID bilan yaratiladi). */
export const PLAY_PLANS = [
  {id: 'toza_oddiy', name: 'Oddiy', what: 'Matn va ovozli xabarlar Toza yopiq bo\'lsa ham saqlanadi'},
  {id: 'toza_toliq', name: 'To\'liq', what: 'Oddiy + rasm va dumaloq video'}
] as const;
export type PlayPlanId = typeof PLAY_PLANS[number]['id'];
export type PlayItem = {id: string; name: string; what: string; price: string; period?: string};

const service = async(): Promise<any> => {
  const w = window as any;
  if(!isPlayApp() || typeof w.getDigitalGoodsService !== 'function' || typeof w.PaymentRequest !== 'function') throw new Error('no_billing');
  return w.getDigitalGoodsService(PLAY_BILLING);
};

const periodText = (p?: string) => ({P1W: 'haftasiga', P1M: 'oyiga', P3M: '3 oyga', P6M: '6 oyga', P1Y: 'yiliga'} as Record<string, string>)[p || ''] || '';
const money = (v: any) => { try { return new Intl.NumberFormat(undefined, {style: 'currency', currency: v.currency}).format(Number(v.value)); } catch{ return `${v?.value} ${v?.currency}`; } };

/** Narxlar Google Play'dan (foydalanuvchi valyutasida). */
export async function playItems(): Promise<PlayItem[]> {
  const s = await service();
  const details: any[] = await s.getDetails(PLAY_PLANS.map((p) => p.id));
  return PLAY_PLANS.map((p) => {
    const d = details.find((x) => x.itemId === p.id);
    return d ? {id: p.id, name: p.name, what: p.what, price: money(d.price), period: periodText(d.subscriptionPeriod)} : null;
  }).filter(Boolean) as PlayItem[];
}

async function sendToServer(api: (path: string, init?: RequestInit) => Promise<Response>, token: string, itemId: string) {
  const r = await api('/tb/play', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({token, sku: itemId, pkg: PKG})});
  if(!r.ok) throw new Error('verify_' + r.status);
}

/** Obuna sotib olish (Google Play oynasi). `api` — Sharpa so'rovi (X-TB-Dev bilan). */
export async function playBuy(itemId: PlayPlanId, api: (path: string, init?: RequestInit) => Promise<Response>): Promise<void> {
  await service();
  const req = new (window as any).PaymentRequest([{supportedMethods: PLAY_BILLING, data: {sku: itemId}}],
    {total: {label: 'Toza Premium', amount: {currency: 'USD', value: '0'}}});
  const res = await req.show();
  const token = res?.details?.purchaseToken || res?.details?.token;
  try {
    if(!token) throw new Error('no_token');
    await sendToServer(api, token, itemId);
    await res.complete('success');
  } catch(e) {
    await res.complete('fail').catch((): void => undefined);
    throw e;
  }
}

/** Xaridni tiklash: yangi telefon yoki qayta o'rnatishda (Play «Restore purchases» talabi). */
export async function playRestore(api: (path: string, init?: RequestInit) => Promise<Response>): Promise<number> {
  const s = await service();
  const list: any[] = await s.listPurchases();
  let n = 0;
  for(const p of list) {
    if(!PLAY_PLANS.some((x) => x.id === p.itemId)) continue;
    await sendToServer(api, p.purchaseToken, p.itemId);
    n++;
  }
  return n;
}

/** Obunani bekor qilish/boshqarish sahifasi (Google Play). */
export const PLAY_MANAGE_URL = 'https://play.google.com/store/account/subscriptions?package=' + PKG;
