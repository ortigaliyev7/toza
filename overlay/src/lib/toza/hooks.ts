import rootScope from '@lib/rootScope';
import {Archive, Sync, TozaApiError, deriveKeys, generateRecoveryCode, normalizeCode, restoreInto} from './core';
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

async function capture(m: any) {
  const inc = toIncoming(m);
  if(inc && (inc.text || inc.kind)) await archive.capture(inc).catch(() => undefined);
}

async function makeSync(code: string) {
  const url = serverUrl();
  if(!url) throw new Error('no_server');
  return new Sync({baseUrl: url, keys: await deriveKeys(code), store});
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
  if(isEnabled()) makeSync(savedCode()).then((s) => { sync = s; }).catch(() => undefined);
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
}

export async function counts() {
  const all = await store.all();
  return {total: all.length, deleted: all.filter((m) => m.deleted).length, pending: (await store.dirty(100000)).length};
}

export async function peerTitle(peerId: string): Promise<string> {
  try {
    const t = await (rootScope as any).managers.appPeersManager.getPeerTitle(Number(peerId), true);
    if(t) return String(t);
  } catch{ /* nom topilmadi */ }
  return 'Chat ' + peerId;
}
