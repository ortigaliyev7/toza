import rootScope from '@lib/rootScope';
import appDownloadManager from '@lib/appDownloadManager';
import choosePhotoSize from '@lib/appManagers/utils/photos/choosePhotoSize';
import {Archive, docKind, MEDIA_LABEL, MEDIA_MAX_BYTES, Sync, VOICE_MAX_BYTES, isBlobKey, keyOf, TozaApiError, deriveKeys, generateRecoveryCode, normalizeCode, restoreInto} from './core';
import type {Incoming, MediaKind, SyncStatus} from './core';
import {IdbStore} from './idb';
import {alertsOn, fmtDuration, notice, pushAlert, setAlertOpener} from './alerts';
import {injectGhosts} from './ghost';
import {applyFlags, getFlags, keywords, keywordsOn, saveOnceOn} from './prefs';
import {matchKeyword} from './tools-core';
import {bindTranslitKeys, startScriptModes} from './translit';
import {mountQuickBar} from './quickbar';
import {startAutoUpdate} from './update';
import {startEyeCare} from './eyecare';
import {startPlayer} from './player';
import {startOpenTracking} from './opened';
import {startSelectionBar} from './selbar';
import {startRoundCamera} from './roundcam';
import {startHoldRecord} from './holdrec';
import {startAnim} from './anim';

const LS_CODE = 'toza_code';
const LS_ON = 'toza_on';
const FLUSH_MS = 15000;

/** Sharpa ichida (iframe) ochilganda: ulanganligi, akkaunt nomi va zaxira holati — ota sahifaga (faqat Sharpa'ning o'z manziliga) yuboriladi. */
let lastStatus = '';
async function selfName(): Promise<string> {
  try {
    const u: any = await (rootScope as any).managers.appUsersManager.getUser(Number(rootScope.myId));
    return [u?.first_name, u?.last_name].filter(Boolean).join(' ').slice(0, 60);
  } catch{ return ''; }
}

export async function reportStatus(connected: boolean) {
  if(window.parent === window) return;
  let origin = '';
  try { origin = new URL(document.referrer).origin; } catch{ /* referrer yo'q */ }
  if(!origin) return;
  const msg = {t: 'toza', v: 1, connected, name: connected ? await selfName() : '', backup: connected && isEnabled()};
  const key = JSON.stringify(msg);
  if(key === lastStatus) return;
  lastStatus = key;
  window.parent.postMessage(msg, origin);
}

export const store = new IdbStore();
export const archive = new Archive(store);

let sync: Sync | null = null;
let started = false;
let timer: number | undefined;
export const state = {lastError: '' as string, lastFlush: 0};

/** Zaxira serveri manzili (Sharpa bot servisi): faqat «origin» olinadi (oxiridagi yo'l/slash xalaqit bermaydi). Toza o'zi statik sahifa, `/tb/*` unda yo'q:
 *  manzil Toza'ning o'zini ko'rsatsa yoki bo'sh bo'lsa, Sharpa ichida ochilganda Sharpa'ning o'z manzili (document.referrer) ishlatiladi. */
export const serverUrl = (): string => {
  let env = (((import.meta as any).env?.VITE_TB_URL as string) || '').trim();
  if(env && !/^https?:\/\//i.test(env)) env = 'https://' + env;                      // «https://» yozilmagan bo'lsa o'zi qo'shiladi
  let origin = '';
  try { if(env) origin = new URL(env, location.href).origin; } catch{ /* noto'g'ri manzil */ }
  if(origin && origin !== location.origin) return origin;
  try {
    const ref = new URL(document.referrer).origin;
    if(window.parent !== window && ref && ref !== location.origin) return ref;
  } catch{ /* referrer yo'q */ }
  return '';
};
export const isEnabled = () => localStorage.getItem(LS_ON) === '1' && !!localStorage.getItem(LS_CODE);
export const savedCode = () => localStorage.getItem(LS_CODE) || '';
export {generateRecoveryCode, normalizeCode, TozaApiError};

function toIncoming(m: any): Incoming | null {
  if(!m || m._ !== 'message' || typeof m.mid !== 'number' || m.peerId === undefined) return null;
  return {peerId: String(m.peerId), mid: m.mid, date: m.date, from: m.fromId !== undefined ? String(m.fromId) : undefined, out: !!m.pFlags?.out, text: m.message || '', kind: m.media?._, ...(m.media?.ttl_seconds ? {once: true} : {})};
}

// ---- Qaysi chatlar saqlanadi: faqat shaxsiy (odam bilan) chatlar; foydalanuvchi alohida chatni o'chira oladi (localStorage).
const LS_OFF = 'toza_chats_off';
const offSet = (): Set<string> => { try { return new Set(JSON.parse(localStorage.getItem(LS_OFF) || '[]')); } catch{ return new Set(); } };
export const isPrivatePeer = (peerId: string | number) => Number(peerId) > 0;
export const chatEnabled = (peerId: string | number) => isPrivatePeer(peerId) && !offSet().has(String(peerId));
export function setChatEnabled(peerId: string | number, on: boolean) {
  const o = offSet();
  if(on) o.delete(String(peerId)); else o.add(String(peerId));
  localStorage.setItem(LS_OFF, JSON.stringify([...o]));
}

// ---- Obuna bor-yo'qligi (serverdan): fayllar (ovoz, rasm, video, hujjat...) faqat obunada
let paid = false;
export const isPaid = () => paid;
export async function refreshPaid() {
  try { const sy = await ensureSync(); paid = !!(sy && (await sy.status()).paid); } catch{ /* tarmoq yo'q: oldingi qiymat qoladi */ }
  return paid;
}

const mediaTried = new Set<string>();
const toBytes = async(blob: Blob) => new Uint8Array(await blob.arrayBuffer());
const toB64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1] || '');
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

/** Ovoz va fayllar (obunada): rasm, video, dumaloq video, GIF, musiqa, hujjat, stiker — yuklab olib shifrlanadigan arxivga qo'shamiz.
 *  Xato bo'lsa xabar matni baribir saqlanadi. */
async function captureMedia(m: any, inc: Incoming) {
  if(!paid || !m?.media) return;
  if(inc.once && !saveOnceOn()) return;                                       // bir martalik media: faqat foydalanuvchi yoqqan bo'lsa
  const k = inc.peerId + ':' + inc.mid;
  if(mediaTried.has(k)) return;
  const doc = m.media._ === 'messageMediaDocument' ? m.media.document : undefined, photo = m.media._ === 'messageMediaPhoto' ? m.media.photo : undefined;
  const kind: MediaKind | 'voice' | null = photo ? 'photo' : docKind(doc);
  if(!kind || (doc && doc._ !== 'document')) return;
  if(doc && Number(doc.size) > (kind === 'voice' ? VOICE_MAX_BYTES : MEDIA_MAX_BYTES[kind])) return;
  mediaTried.add(k);
  try {
    if(kind === 'voice') {
      if(await archive.voiceOf(inc.peerId, inc.mid)) return;
      const blob: Blob = await (appDownloadManager as any).downloadMedia({media: doc});
      if(!blob || blob.size > VOICE_MAX_BYTES) return;
      await archive.captureVoice(inc, {mime: doc.mime_type || blob.type || 'audio/ogg', dur: Number(doc.duration) || 0, b64: await toB64(blob)});
    } else if(photo) {
      if(await archive.mediaOf(inc.peerId, inc.mid)) return;
      const size = choosePhotoSize(photo, 1280, 1280);                  // 1280 px gacha (sifatli, lekin og'ir emas)
      const blob: Blob = await (appDownloadManager as any).downloadMedia({media: photo, thumb: size});
      if(blob) await archive.captureMedia(inc, 'photo', blob.type || 'image/jpeg', 0, await toBytes(blob));
    } else {
      if(await archive.mediaOf(inc.peerId, inc.mid)) return;
      const blob: Blob = await (appDownloadManager as any).downloadMedia({media: doc});
      if(blob) await archive.captureMedia(inc, kind, doc.mime_type || blob.type || 'application/octet-stream', Number(doc.duration) || 0, await toBytes(blob), doc.file_name);
    }
  } catch{ mediaTried.delete(k); /* keyingi safar qayta uriniladi */ }
}

// ---- Toza yopiq bo'lgan vaqt (bo'shliq): shu vaqtda kelib o'chirilgan xabarlar matni saqlanmagan bo'lishi mumkin
const LS_SEEN = 'toza_seen', LS_GAPS = 'toza_gaps', GAP_MIN_MS = 10 * 60 * 1000;
export type Gap = {from: number; to: number};
export const gaps = (): Gap[] => { try { return JSON.parse(localStorage.getItem(LS_GAPS) || '[]'); } catch{ return []; } };
function markSeen() { try { localStorage.setItem(LS_SEEN, String(Date.now())); } catch{ /* xotira yopiq */ } }
/** Toza yopiq bo'lgan vaqtni yozib qo'yadi. Qaytaradi: oldingi «ko'rilgan» vaqt (ms) — tarixdan to'ldirish shu vaqtdan boshlanadi. */
function checkGap(): number {
  const last = Number(localStorage.getItem(LS_SEEN) || 0), now = Date.now();
  if(last && now - last > GAP_MIN_MS) {
    const g = [...gaps(), {from: last, to: now}].slice(-20);
    localStorage.setItem(LS_GAPS, JSON.stringify(g));
    setTimeout(() => notice('Toza', `Toza ${fmtDuration(now - last)} yopiq edi. Shu vaqtda kelgan xabarlar tarixdan saqlanmoqda. Shu orada o'chirilganlarini esa qaytarib bo'lmaydi.`), 4000);
  }
  markSeen();
  return last;
}

// ---- Bo'shliqni to'ldirish: Toza yopiq paytda kelgan (hali o'chirilmagan) xabarlarni shaxsiy chatlar tarixidan olib arxivga yozamiz.
// Keyin ular o'chirilsa ham nusxasi qoladi. Telegram'ga ortiqcha yuk bo'lmasligi uchun: faqat yangi xabari bor chatlar, chat orasida pauza.
export const BACKFILL_MAX_CHATS = 40, BACKFILL_PER_CHAT = 100;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const backfillState = {running: false, chats: 0, saved: 0, at: 0};

export async function backfill(sinceMs: number): Promise<number> {
  if(backfillState.running || !sinceMs || !isEnabled()) return 0;
  backfillState.running = true;
  let saved = 0, chats = 0;
  const since = Math.floor(sinceMs / 1000) - 120;                                  // 2 daqiqa zaxira bilan
  try {
    const mgr = (rootScope as any).managers;
    let dialogs: any[] = [];
    for(let i = 0; i < 10 && !dialogs.length; i++) {                               // ro'yxat hali yuklanmagan bo'lishi mumkin
      try { dialogs = await mgr.dialogsStorage.getCachedDialogs(true) || []; } catch{ dialogs = []; }
      if(!dialogs.length) await sleep(1500);
    }
    const peers = dialogs.filter((d) => d?.peerId && chatEnabled(d.peerId) && d.top_message).slice(0, 200);
    for(const d of peers) {
      if(chats >= BACKFILL_MAX_CHATS || !isEnabled()) break;
      const top = await mgr.appMessagesManager.getMessageByPeer(d.peerId, d.top_message).catch((): any => undefined);
      if(!top || top.date < since) continue;
      chats++;
      const res = await mgr.appMessagesManager.getHistory({peerId: d.peerId, limit: BACKFILL_PER_CHAT}).catch((): any => undefined);
      for(const mid of res?.history || []) {
        const m = await mgr.appMessagesManager.getMessageByPeer(d.peerId, mid).catch((): any => undefined);
        if(!m || m.date < since) continue;
        const before = await store.get(keyOf(String(m.peerId), m.mid));
        await capture(m);
        if(!before) saved++;
      }
      await sleep(400);
    }
  } finally {
    Object.assign(backfillState, {running: false, chats, saved, at: Date.now()});
  }
  if(saved) { updateBadge(); scheduleGhosts(); }
  return saved;
}

const canAlert = () => paid && alertsOn() && isEnabled();

async function capture(m: any, announce = false) {
  const inc = toIncoming(m);
  if(!inc || !chatEnabled(inc.peerId)) return;
  const before = announce && canAlert() && !inc.out ? (await store.get(keyOf(inc.peerId, inc.mid)))?.text : undefined;
  let st: string | void = undefined;
  if(inc.text || inc.kind) st = await archive.capture(inc).catch(() => undefined);
  if(st === 'edited' && before !== undefined && before !== inc.text) peerTitle(inc.peerId).then((who) => pushAlert({kind: 'edited', who, text: inc.text, old: before}));
  if(isEnabled()) captureMedia(m, inc);
}

/** O'chirilgan (boshqalarning) xabarlari: arxivdagi matn bilan xabar beramiz, so'ng «o'chirilgan» deb belgilaymiz. */
async function onDeleted(peerId: string, mids: Iterable<number>) {
  const list = [...mids];
  if(chatEnabled(peerId) && canAlert()) {
    const who = await peerTitle(peerId);
    for(const mid of list) {
      const rec = await store.get(keyOf(peerId, mid));
      if(rec && !rec.deleted && !rec.out) {
        const voice = await archive.voiceOf(peerId, mid), file = await archive.mediaOf(peerId, mid);
        pushAlert({kind: 'deleted', who, text: rec.text || (voice ? MEDIA_LABEL.voice.toLowerCase() : file ? MEDIA_LABEL[file.kind].toLowerCase() + (file.name ? ' «' + file.name + '»' : '') : rec.kind ? rec.kind.replace('messageMedia', '').toLowerCase() : '')});
      }
    }
  }
  await archive.deleted(peerId, list);
  updateBadge();
  scheduleGhosts(900);                                      // tweb bubbleni olib tashlab bo'lgach
}

/** Sinxronlash obyekti hali yaratilmagan bo'lsa (sahifa endi ochilgan, avvalgi urinish xato bergan) — yoqilgan zaxira uchun yaratadi. «O'chiq» deb adashmaslik uchun. */
let syncPromise: Promise<Sync | null> | null = null;
async function ensureSync(): Promise<Sync | null> {
  if(sync) return sync;
  if(!isEnabled()) return null;
  syncPromise ||= makeSync(savedCode()).then((x) => { sync = x; return x; }).catch(() => null).finally(() => { syncPromise = null; });
  return syncPromise;
}

async function makeSync(code: string) {
  const url = serverUrl();
  if(!url) throw new Error('no_server');
  return new Sync({baseUrl: url, keys: await deriveKeys(code), store, mediaAllowed: () => paid});
}

export async function flushNow(): Promise<number> {
  const sy = await ensureSync();
  if(!sy) return 0;
  try {
    const n = await sy.flush();
    state.lastError = '';
    if(n) state.lastFlush = Date.now();
    return n;
  } catch(e: any) {
    state.lastError = e instanceof TozaApiError ? e.code : String(e?.message || e);
    throw e;
  }
}

// ---- O'chirilgan xabarlarni chat tarixining o'z joyiga qaytarish (ko'lanka bloklar): chat o'zgarganda/yuklanganda va o'chirilgandan keyin
let ghostTimer: number | undefined;
function scheduleGhosts(delay = 500) {
  clearTimeout(ghostTimer);
  ghostTimer = window.setTimeout(() => {
    if(!isEnabled()) return;
    injectGhosts({records: () => store.all(), voiceOf: (p, m) => archive.voiceOf(p, m), mediaOf: (p, m) => archive.mediaOf(p, m), enabled: chatEnabled});
  }, delay);
}

// ---- Ochiq chatdagi o'chirilgan xabarlar belgisi: bosilsa shu chatning o'chirilganlari ro'yxati ochiladi
let currentPeer = '';
let badgeEl: HTMLElement | null = null;
async function updateBadge() {
  try {
    const n = isEnabled() && currentPeer && chatEnabled(currentPeer) ? (await store.all()).filter((m) => m.peerId === currentPeer && m.deleted && !isBlobKey(m.k)).length : 0;
    if(!n) { badgeEl?.remove(); badgeEl = null; return; }
    if(!badgeEl) {
      badgeEl = document.createElement('button');
      badgeEl.setAttribute('style', 'position:fixed;top:66px;right:12px;z-index:1000;border:0;border-radius:99px;padding:6px 12px;font:600 12px system-ui,sans-serif;color:#fff;background:#e8860c;box-shadow:0 3px 10px rgba(0,0,0,.25);cursor:pointer;');
      badgeEl.onclick = () => { const p = currentPeer; import('./ui').then((m) => m.openTozaBackup({peerId: p})); };
      document.body.append(badgeEl);
    }
    badgeEl.textContent = `O'chirilgan: ${n}`;
  } catch{ /* belgi muhim emas */ }
}

// ---- Kalit so'z bo'yicha xabar berish: guruh/kanal/shaxsiy chatda belgilangan so'z chiqsa (Toza ochiq bo'lsa). Hammasi shu brauzerda.
async function onKeyword(m: any) {
  if(!keywordsOn() || !m || m._ !== 'message' || m.pFlags?.out || !m.message) return;
  const hit = matchKeyword(m.message, keywords());
  if(!hit) return;
  if(!document.hidden && currentPeer === String(m.peerId)) return;                 // shu chat ochiq turibdi
  const who = await peerTitle(String(m.peerId));
  notice(`🔔 ${who}`, `«${hit}»: ${m.message.length > 140 ? m.message.slice(0, 139) + '…' : m.message}`);
}

// ---- Ko'rinmas rejim: ochiq chatda «O'qildi deb yuborish» tugmasi (o'qildi belgisi faqat shu tugma bosilganda ketadi)
let readBtn: HTMLElement | null = null;
export async function updateReadButton() {
  try {
    if(!getFlags().noRead || !currentPeer) { readBtn?.remove(); readBtn = null; return; }
    if(!readBtn) {
      readBtn = document.createElement('button');
      readBtn.setAttribute('style', 'position:fixed;top:66px;right:150px;z-index:1000;border:0;border-radius:99px;padding:6px 12px;font:600 12px system-ui,sans-serif;color:#fff;background:var(--primary-color,#3390ec);box-shadow:0 3px 10px rgba(0,0,0,.25);cursor:pointer;');
      readBtn.title = 'Ko\'rinmas rejim yoqilgan: suhbatdosh xabari o\'qilganini ko\'rmaydi';
      readBtn.onclick = () => markReadNow(currentPeer);
      document.body.append(readBtn);
    }
    readBtn.textContent = '👁 O\'qildi yuborish';
  } catch{ /* muhim emas */ }
}
export async function markReadNow(peerId: string) {
  if(!peerId) return;
  const mgr = (rootScope as any).managers;
  try {
    const top = (await mgr.appMessagesManager.getDialogOnly(Number(peerId)))?.top_message;
    if(top) await mgr.appMessagesManager.readHistory({peerId: Number(peerId), maxId: top, force: true});
    if(readBtn) { readBtn.textContent = '✓ Yuborildi'; setTimeout(() => readBtn && (readBtn.textContent = '👁 O\'qildi yuborish'), 1500); }
  } catch{ /* tarmoq */ }
}

function observeBubbles() {
  const seen = new Set<string>();
  let queue: {peerId: any; mid: number}[] = [];
  let t: number | undefined;
  const run = async() => {
    const list = queue.splice(0, queue.length);
    for(const {peerId, mid} of list) {
      try { await capture(await (rootScope as any).managers.appMessagesManager.getMessageByPeer(peerId, mid)); } catch{ /* xabar topilmadi */ }
      currentPeer = String(peerId);
    }
    updateBadge();
    updateReadButton();
    scheduleGhosts();
  };
  const take = (el: Element) => {
    const bubbles = el.matches?.('.bubble[data-mid]') ? [el] : Array.from(el.querySelectorAll?.('.bubble[data-mid]') || []);
    for(const b of bubbles as HTMLElement[]) {
      const k = b.dataset.peerId + ':' + b.dataset.mid;
      if(!b.dataset.peerId || seen.has(k)) continue;
      seen.add(k);
      queue.push({peerId: (b.dataset.peerId as any).toPeerId?.() ?? Number(b.dataset.peerId), mid: +b.dataset.mid!});
    }
    if(queue.length) { clearTimeout(t); t = window.setTimeout(run, 400); }
  };
  new MutationObserver((muts) => muts.forEach((mu) => mu.addedNodes.forEach((n) => n.nodeType === 1 && take(n as Element)))).observe(document.body, {childList: true, subtree: true});
}

/** Ilova ochilishini sekinlashtirmaslik uchun: brauzer bo'sh qolganda (eng kechi 3 soniyada) bajaradi. */
const later = (fn: () => void) => {
  const ric = (window as any).requestIdleCallback as ((cb: () => void, o: {timeout: number}) => number) | undefined;
  ric ? ric(fn, {timeout: 3000}) : setTimeout(fn, 1200);
};

let lastOnline = 0;
async function syncOnline() {
  await applyFlags();
  if(getFlags().noOnline || document.hidden || Date.now() - lastOnline < 20000) return;
  lastOnline = Date.now();
  try { await (rootScope as any).managers.appUsersManager.updateMyOnlineStatus(false); } catch{ /* tarmoq */ }
}

/** Hodisa ushlagichlari va davriy yuklashni bir marta o'rnatadi. Arxiv faqat foydalanuvchi YOQQANDAN keyin to'planadi. */
export function startTozaBackup() {
  if(started) return;
  started = true;
  const on = (fn: (...a: any[]) => any) => (...a: any[]) => { if(isEnabled()) fn(...a); };
  rootScope.addEventListener('history_append', on(({message}: any) => capture(message)));
  rootScope.addEventListener('history_append', ({message}: any) => { onKeyword(message).catch((): void => undefined); });
  bindTranslitKeys();
  try { startScriptModes(); } catch{ /* lotin/kirill rejimlari muhim emas */ }
  try { mountQuickBar(); } catch{ /* tezkor tugmalar muhim emas */ }
  try { startEyeCare(); } catch{ /* ko'z asrash muhim emas */ }     // darrov: ekran bir lahza yorqin bo'lib ketmasin
  try { startAnim(); } catch{ /* animatsiyalar muhim emas */ }
  // Qolganlari chatlar ro'yxati chizilgandan keyin, brauzer bo'sh turganda: ilova tezroq ochiladi
  later(() => {
    try { startAutoUpdate(); } catch{ /* yangilanish tekshiruvi muhim emas */ }
    try { startPlayer(); } catch{ /* pleyer qo'shimchalari muhim emas */ }
    startOpenTracking().catch((): void => undefined);
    try { startSelectionBar(); } catch{ /* tezkor belgilash muhim emas */ }
    try { startRoundCamera(); } catch{ /* kamera almashtirish muhim emas */ }
    try { startHoldRecord(); } catch{ /* bosib turib yozish muhim emas */ }
  });
  // ishchi qayta ishga tushgan bo'lishi mumkin: har safar sahifaga qaytganda holatni qayta yuboramiz.
  // «Offlayn» o'chiq bo'lsa, darrov «onlayn» bo'lamiz (avval «offlayn» yuborilgan bo'lsa ham qolib ketmasin).
  document.addEventListener('visibilitychange', () => { if(!document.hidden) syncOnline(); });
  window.addEventListener('focus', () => syncOnline());
  syncOnline();
  rootScope.addEventListener('history_multiappend', on((message: any) => capture(message)));
  rootScope.addEventListener('message_edit', on(({message}: any) => capture(message, true)));
  rootScope.addEventListener('history_delete', on(({peerId, msgs}: any) => onDeleted(String(peerId), msgs)));
  applyProfileTheme();
  if(isEnabled()) { const last = checkGap(); setTimeout(() => { backfill(last).catch((): void => undefined); }, 6000); }
  window.setInterval(() => { if(isEnabled()) markSeen(); }, 30000);
  window.addEventListener('pagehide', markSeen);
  setAlertOpener(() => { import('./ui').then((m) => m.openTozaBackup()); });
  observeBubbles();
  rootScope.addEventListener('logging_out', () => { reportStatus(false); });
  later(() => reportStatus(true));
  // Sharpa «Zaxirani yoqish» bosilganda (?zaxira=1): kirgandan keyin zaxira oynasini o'zi ochamiz
  if(!isEnabled() && /[?&]zaxira=1/.test(location.search)) setTimeout(() => { import('./ui').then((m) => m.openTozaBackup()); }, 1200);
  document.addEventListener('visibilitychange', () => { if(!document.hidden) { lastStatus = ''; reportStatus(true); } });
  later(() => {
    if(isEnabled()) ensureSync().then(() => refreshPaid());
    try { navigator.storage?.persist?.(); } catch{ /* ruxsat yo'q */ }
  });          // brauzer joy tanqisligida Toza ma'lumotini (zaxira kaliti) o'chirib yubormasin
  window.setInterval(() => { if(isEnabled()) refreshPaid(); }, 10 * 60 * 1000);
  timer = window.setInterval(() => { if(isEnabled()) flushNow().catch(() => undefined); }, FLUSH_MS);
  document.addEventListener('visibilitychange', () => { if(document.hidden && isEnabled()) flushNow().catch(() => undefined); });
}

/** Zaxirani yoqadi: serverda to'plam yaratadi, kodni shu brauzerda saqlaydi. */
export async function enableBackup(code: string): Promise<'created' | 'exists'> {
  const norm = normalizeCode(code);
  if(!norm) throw new Error('bad_code');
  const s = await makeSync(norm);
  const res = await s.init();
  localStorage.setItem(LS_CODE, norm);
  localStorage.setItem(LS_ON, '1');
  sync = s;
  startTozaBackup();
  reportStatus(true);
  refreshPaid();
  return res;
}

/** Yangi qurilmada: mavjud kod bilan serverdan arxivni tiklaydi va zaxirani shu qurilmada davom ettiradi. */
export async function restoreBackup(code: string): Promise<{messages: number; deleted: number}> {
  const norm = normalizeCode(code);
  if(!norm) throw new Error('bad_code');
  const s = await makeSync(norm);
  await s.status(); // 404 bo'lsa — bunday zaxira yo'q (yangisini yaratmaymiz)
  const res = await restoreInto(s, archive);
  localStorage.setItem(LS_CODE, norm);
  localStorage.setItem(LS_ON, '1');
  sync = s;
  startTozaBackup();
  reportStatus(true);
  return res;
}

export async function disableBackup(wipeServer: boolean) {
  const sy = await ensureSync();
  if(wipeServer && sy) await sy.wipe();
  localStorage.removeItem(LS_ON);
  localStorage.removeItem(LS_CODE);
  localStorage.removeItem('toza_sharpa');                     // eski Sharpa qurilma tokeni (endi ishlatilmaydi)
  sync = null;
  await store.clear();
  reportStatus(true);
}

export async function serverStatus(): Promise<SyncStatus | null> {
  const sy = await ensureSync();
  return sy ? sy.status() : null;
}

export async function linkSharpa(code: string) {
  const sy = await ensureSync();
  if(!sy) throw new Error('off');
  await sy.link(code.trim().toUpperCase());
  await refreshPaid();
}

/** Har bir chat qancha joy egallaydi (brauzerning o'zida hisoblanadi: server shifrlangan ichini ko'rmaydi). */
export async function chatUsage(): Promise<{peerId: string; msgs: number; files: number; bytes: number; on: boolean}[]> {
  const by = new Map<string, {peerId: string; msgs: number; files: number; bytes: number; on: boolean}>();
  for(const m of await store.all()) {
    const e = by.get(m.peerId) || {peerId: m.peerId, msgs: 0, files: 0, bytes: 0, on: chatEnabled(m.peerId)};
    if(isBlobKey(m.k)) {
      e.bytes += Math.floor(((m.voice?.b64.length || 0) + (m.media?.b64.length || 0)) * 3 / 4);
      if(m.voice || m.media?.i === 0) e.files++;
    } else { e.bytes += JSON.stringify(m).length; e.msgs++; }
    by.set(m.peerId, e);
  }
  return [...by.values()].sort((a, b) => b.bytes - a.bytes);
}

/** Chatni zaxiradan butunlay olib tashlaydi: saqlash o'chadi, mahalliy nusxa o'chadi, serverdagi zaxira qolgan chatlardan qayta yoziladi. */
export async function purgeChat(peerId: string): Promise<void> {
  const sy = await ensureSync();
  if(!sy) throw new Error('off');
  setChatEnabled(peerId, false);
  await archive.purgePeer(peerId);
  await sy.reset();
  await store.markAllDirty();
  await flushNow();
}

// ---- Toza profili: shaxsiy status, emoji va rang mavzusi (faqat shu brauzerda saqlanadi)
export type TozaProfile = {status: string; emoji: string; accent: string};
const LS_PROFILE = 'toza_profile';
export const getProfile = (): TozaProfile => { try { return {status: '', emoji: '', accent: '', ...JSON.parse(localStorage.getItem(LS_PROFILE) || '{}')}; } catch{ return {status: '', emoji: '', accent: ''}; } };
export function setProfile(p: TozaProfile) {
  localStorage.setItem(LS_PROFILE, JSON.stringify({status: p.status.slice(0, 70), emoji: p.emoji.slice(0, 4), accent: /^#[0-9a-f]{6}$/i.test(p.accent) ? p.accent : ''}));
  applyProfileTheme();
}
export function applyProfileTheme() {
  const a = getProfile().accent, st = document.documentElement.style;
  if(a) { st.setProperty('--primary-color', a); st.setProperty('--link-color', a); st.setProperty('--tz-a', a); st.setProperty('--tz-b', a); } else { ['--primary-color', '--link-color', '--tz-a', '--tz-b'].forEach((k) => st.removeProperty(k)); }
}

export async function counts() {
  const all = await store.all();
  const msgs = all.filter((m) => !isBlobKey(m.k));
  return {total: msgs.length, voices: all.filter((m) => m.k.startsWith('v:')).length, files: all.filter((m) => m.k.startsWith('m:') && m.media?.i === 0).length, deleted: msgs.filter((m) => m.deleted).length, pending: (await store.dirty(100000)).length};
}

export async function peerTitle(peerId: string): Promise<string> {
  try {
    const t = await (rootScope as any).managers.appPeersManager.getPeerTitle(Number(peerId), true);
    if(t) return String(t);
  } catch{ /* nom topilmadi */ }
  return 'Chat ' + peerId;
}
