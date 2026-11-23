import rootScope from '@lib/rootScope';
import appDownloadManager from '@lib/appDownloadManager';
import choosePhotoSize from '@lib/appManagers/utils/photos/choosePhotoSize';
import {Archive, MEDIA_MAX_BYTES, Sync, VOICE_MAX_BYTES, isBlobKey, keyOf, TozaApiError, deriveKeys, generateRecoveryCode, normalizeCode, restoreInto} from './core';
import type {Incoming, SyncStatus} from './core';
import {IdbStore} from './idb';
import {alertsOn, fmtDuration, notice, pushAlert, setAlertOpener} from './alerts';
import {injectGhosts} from './ghost';

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
  return {peerId: String(m.peerId), mid: m.mid, date: m.date, from: m.fromId !== undefined ? String(m.fromId) : undefined, out: !!m.pFlags?.out, text: m.message || '', kind: m.media?._};
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

// ---- Obuna bor-yo'qligi (serverdan): ovoz, rasm va dumaloq video faqat obunada
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

/** Ovoz, rasm, dumaloq video (obunada): yuklab olib shifrlanadigan arxivga qo'shamiz. Xato bo'lsa xabar matni baribir saqlanadi. */
async function captureMedia(m: any, inc: Incoming) {
  if(!paid || !m?.media) return;
  const k = inc.peerId + ':' + inc.mid;
  if(mediaTried.has(k)) return;
  const doc = m.media.document, photo = m.media.photo;
  const isVoice = m.media._ === 'messageMediaDocument' && doc?.type === 'voice';
  const isRound = m.media._ === 'messageMediaDocument' && doc?.type === 'round';
  const isVideo = m.media._ === 'messageMediaDocument' && doc?.type === 'video';
  const isPhoto = m.media._ === 'messageMediaPhoto' && !!photo;
  if(!isVoice && !isRound && !isVideo && !isPhoto) return;
  if((isVoice || isRound || isVideo) && Number(doc.size) > (isVoice ? VOICE_MAX_BYTES : isRound ? MEDIA_MAX_BYTES.round : MEDIA_MAX_BYTES.video)) return;
  mediaTried.add(k);
  try {
    if(isVoice) {
      if(await archive.voiceOf(inc.peerId, inc.mid)) return;
      const blob: Blob = await (appDownloadManager as any).downloadMedia({media: doc});
      if(!blob || blob.size > VOICE_MAX_BYTES) return;
      await archive.captureVoice(inc, {mime: doc.mime_type || blob.type || 'audio/ogg', dur: Number(doc.duration) || 0, b64: await toB64(blob)});
    } else if(isRound || isVideo) {
      if(await archive.mediaOf(inc.peerId, inc.mid)) return;
      const blob: Blob = await (appDownloadManager as any).downloadMedia({media: doc});
      if(blob) await archive.captureMedia(inc, isRound ? 'round' : 'video', doc.mime_type || blob.type || 'video/mp4', Number(doc.duration) || 0, await toBytes(blob));
    } else {
      if(await archive.mediaOf(inc.peerId, inc.mid)) return;
      const size = choosePhotoSize(photo, 1280, 1280);                  // 1280 px gacha (sifatli, lekin og'ir emas)
      const blob: Blob = await (appDownloadManager as any).downloadMedia({media: photo, thumb: size});
      if(blob) await archive.captureMedia(inc, 'photo', blob.type || 'image/jpeg', 0, await toBytes(blob));
    }
  } catch{ mediaTried.delete(k); /* keyingi safar qayta uriniladi */ }
}

// ---- Toza yopiq bo'lgan vaqt (bo'shliq): shu vaqtda kelib o'chirilgan xabarlar matni saqlanmagan bo'lishi mumkin
const LS_SEEN = 'toza_seen', LS_GAPS = 'toza_gaps', GAP_MIN_MS = 10 * 60 * 1000;
export type Gap = {from: number; to: number};
export const gaps = (): Gap[] => { try { return JSON.parse(localStorage.getItem(LS_GAPS) || '[]'); } catch{ return []; } };
function markSeen() { try { localStorage.setItem(LS_SEEN, String(Date.now())); } catch{ /* xotira yopiq */ } }
function checkGap() {
  const last = Number(localStorage.getItem(LS_SEEN) || 0), now = Date.now();
  if(last && now - last > GAP_MIN_MS) {
    const g = [...gaps(), {from: last, to: now}].slice(-20);
    localStorage.setItem(LS_GAPS, JSON.stringify(g));
    setTimeout(() => notice('Toza', `Toza ${fmtDuration(now - last)} yopiq edi. Shu vaqtda kelib o'chirilgan xabarlarning matni saqlanmagan bo'lishi mumkin.`), 4000);
  }
  markSeen();
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
        pushAlert({kind: 'deleted', who, text: rec.text || (voice ? 'ovozli xabar' : file ? (file.kind === 'photo' ? 'rasm' : file.kind === 'round' ? 'dumaloq video' : 'video') : rec.kind ? rec.kind.replace('messageMedia', '').toLowerCase() : '')});
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

/** Hodisa ushlagichlari va davriy yuklashni bir marta o'rnatadi. Arxiv faqat foydalanuvchi YOQQANDAN keyin to'planadi. */
export function startTozaBackup() {
  if(started) return;
  started = true;
  const on = (fn: (...a: any[]) => any) => (...a: any[]) => { if(isEnabled()) fn(...a); };
  rootScope.addEventListener('history_append', on(({message}: any) => capture(message)));
  rootScope.addEventListener('history_multiappend', on((message: any) => capture(message)));
  rootScope.addEventListener('message_edit', on(({message}: any) => capture(message, true)));
  rootScope.addEventListener('history_delete', on(({peerId, msgs}: any) => onDeleted(String(peerId), msgs)));
  if(isEnabled()) checkGap();
  window.setInterval(() => { if(isEnabled()) markSeen(); }, 30000);
  window.addEventListener('pagehide', markSeen);
  setAlertOpener(() => { import('./ui').then((m) => m.openTozaBackup()); });
  observeBubbles();
  rootScope.addEventListener('logging_out', () => { reportStatus(false); });
  reportStatus(true);
  // Sharpa «Zaxirani yoqish» bosilganda (?zaxira=1): kirgandan keyin zaxira oynasini o'zi ochamiz
  if(!isEnabled() && /[?&]zaxira=1/.test(location.search)) setTimeout(() => { import('./ui').then((m) => m.openTozaBackup()); }, 1200);
  document.addEventListener('visibilitychange', () => { if(!document.hidden) { lastStatus = ''; reportStatus(true); } });
  if(isEnabled()) ensureSync().then(() => refreshPaid());
  try { navigator.storage?.persist?.(); } catch{ /* ruxsat yo'q */ }          // brauzer joy tanqisligida Toza ma'lumotini (zaxira kaliti) o'chirib yubormasin
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
  localStorage.removeItem(LS_SHARPA);
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

// ---- Sharpa bo'limlari (Bozor, Profil): Sharpa Mini App Toza ichida ochiladi. Zaxira KERAK EMAS.
// Kirish: Toza Telegram'dagi o'z foydalanuvchingiz nomidan Sharpa botiga bir martalik `/start toza_<kod>` yuboradi; bot haqiqiy jo'natuvchini ko'radi
// va kodni shu ID ga bog'laydi; Toza kodni so'rab turib qurilma tokenini oladi (shu brauzerda saqlanadi). Telegram sessiyangiz Sharpa'ga berilmaydi.
const LS_SHARPA = 'toza_sharpa';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function tbPost(path: string, body?: any): Promise<Response> {
  const base = serverUrl();
  if(!base) throw new Error('no_server');
  return fetch(base + path, {method: 'POST', headers: body ? {'Content-Type': 'application/json'} : {}, body: body ? JSON.stringify(body) : undefined});
}
export async function sharpaAccess(force = false): Promise<{k: string; url: string}> {
  if(!force) { try { const c = JSON.parse(localStorage.getItem(LS_SHARPA) || 'null'); if(c?.k && c?.url) return c; } catch{ /* yo'q */ } }
  const nr = await tbPost('/tb/nonce');
  if(!nr.ok) throw new TozaApiError(nr.status, 'error');
  const {nonce, bot} = await nr.json();
  const managers = (rootScope as any).managers;
  const peer = await managers.appUsersManager.resolveUsername(String(bot));
  if(!peer) throw new Error('no_bot');
  await managers.appMessagesManager.sendText({peerId: Number(peer.id), text: `/start toza_${nonce}`});
  for(let i = 0; i < 24; i++) {                              // ~36 soniya
    await sleep(1500);
    const r = await tbPost('/tb/login', {nonce});
    if(r.status === 202) continue;
    if(!r.ok) throw new TozaApiError(r.status, (await r.json().catch(() => ({})))?.error || 'error');
    const d = await r.json();
    localStorage.setItem(LS_SHARPA, JSON.stringify(d));
    return d;
  }
  throw new Error('bot_timeout');
}
export const forgetSharpa = () => localStorage.removeItem(LS_SHARPA);

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
