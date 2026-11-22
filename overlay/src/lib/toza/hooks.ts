import rootScope from '@lib/rootScope';
import appDownloadManager from '@lib/appDownloadManager';
import choosePhotoSize from '@lib/appManagers/utils/photos/choosePhotoSize';
import {Archive, MEDIA_MAX_BYTES, Sync, VOICE_MAX_BYTES, isBlobKey, voiceKey, mediaKey, TozaApiError, deriveKeys, generateRecoveryCode, normalizeCode, restoreInto} from './core';
import type {Incoming, SyncStatus} from './core';
import {IdbStore} from './idb';

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

export const serverUrl = (): string => ((import.meta as any).env?.VITE_TB_URL as string) || '';
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
  try { paid = !!(sync && (await sync.status()).paid); } catch{ /* tarmoq yo'q: oldingi qiymat qoladi */ }
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
  const isPhoto = m.media._ === 'messageMediaPhoto' && !!photo;
  if(!isVoice && !isRound && !isPhoto) return;
  if((isVoice || isRound) && Number(doc.size) > (isVoice ? VOICE_MAX_BYTES : MEDIA_MAX_BYTES.round)) return;
  mediaTried.add(k);
  try {
    if(isVoice) {
      if(await archive.voiceOf(inc.peerId, inc.mid)) return;
      const blob: Blob = await (appDownloadManager as any).downloadMedia({media: doc});
      if(!blob || blob.size > VOICE_MAX_BYTES) return;
      await archive.captureVoice(inc, {mime: doc.mime_type || blob.type || 'audio/ogg', dur: Number(doc.duration) || 0, b64: await toB64(blob)});
    } else if(isRound) {
      if(await archive.mediaOf(inc.peerId, inc.mid)) return;
      const blob: Blob = await (appDownloadManager as any).downloadMedia({media: doc});
      if(blob) await archive.captureMedia(inc, 'round', doc.mime_type || blob.type || 'video/mp4', Number(doc.duration) || 0, await toBytes(blob));
    } else {
      if(await archive.mediaOf(inc.peerId, inc.mid)) return;
      const size = choosePhotoSize(photo, 1280, 1280);                  // 1280 px gacha (sifatli, lekin og'ir emas)
      const blob: Blob = await (appDownloadManager as any).downloadMedia({media: photo, thumb: size});
      if(blob) await archive.captureMedia(inc, 'photo', blob.type || 'image/jpeg', 0, await toBytes(blob));
    }
  } catch{ mediaTried.delete(k); /* keyingi safar qayta uriniladi */ }
}

async function capture(m: any) {
  const inc = toIncoming(m);
  if(!inc || !chatEnabled(inc.peerId)) return;
  if(inc.text || inc.kind) await archive.capture(inc).catch(() => undefined);
  if(isEnabled()) captureMedia(m, inc);
}

async function makeSync(code: string) {
  const url = serverUrl();
  if(!url) throw new Error('no_server');
  return new Sync({baseUrl: url, keys: await deriveKeys(code), store, mediaAllowed: () => paid});
}

export async function flushNow(): Promise<number> {
  if(!sync) return 0;
  try {
    const n = await sync.flush();
    state.lastError = '';
    if(n) state.lastFlush = Date.now();
    return n;
  } catch(e: any) {
    state.lastError = e instanceof TozaApiError ? e.code : String(e?.message || e);
    throw e;
  }
}

function observeBubbles() {
  const seen = new Set<string>();
  let queue: {peerId: any; mid: number}[] = [];
  let t: number | undefined;
  const run = async() => {
    const list = queue.splice(0, queue.length);
    for(const {peerId, mid} of list) {
      try { await capture(await (rootScope as any).managers.appMessagesManager.getMessageByPeer(peerId, mid)); } catch{ /* xabar topilmadi */ }
    }
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
  rootScope.addEventListener('message_edit', on(({message}: any) => capture(message)));
  rootScope.addEventListener('history_delete', on(({peerId, msgs}: any) => archive.deleted(String(peerId), msgs)));
  observeBubbles();
  rootScope.addEventListener('logging_out', () => { reportStatus(false); });
  reportStatus(true);
  // Sharpa «Zaxirani yoqish» bosilganda (?zaxira=1): kirgandan keyin zaxira oynasini o'zi ochamiz
  if(!isEnabled() && /[?&]zaxira=1/.test(location.search)) setTimeout(() => { import('./ui').then((m) => m.openTozaBackup()); }, 1200);
  document.addEventListener('visibilitychange', () => { if(!document.hidden) { lastStatus = ''; reportStatus(true); } });
  if(isEnabled()) makeSync(savedCode()).then((s) => { sync = s; return refreshPaid(); }).catch(() => undefined);
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
  if(wipeServer && sync) await sync.wipe();
  localStorage.removeItem(LS_ON);
  localStorage.removeItem(LS_CODE);
  sync = null;
  await store.clear();
  reportStatus(true);
}

export async function serverStatus(): Promise<SyncStatus | null> {
  return sync ? sync.status() : null;
}

export async function linkSharpa(code: string) {
  if(!sync) throw new Error('off');
  await sync.link(code.trim().toUpperCase());
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
