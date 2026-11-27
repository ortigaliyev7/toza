// Toza yopiq bo'lsa ham: Sharpa boti Telegram Business orqali shaxsiy chatlardagi xabarlarni doim (24/7) ushlab turadi.
// Toza ochilganda Sharpa'dan o'chirilgan va tahrirlangan xabarlarni olib, o'z arxiviga qo'shadi: ular chatning o'zida ko'rinadi.
//  - Ulanish bir bosishda: Toza foydalanuvchi nomidan botga `/start toza_<kod>` yuboradi, bot haqiqiy Telegram ID'ni ko'radi
//    va qurilma tokenini beradi (Sharpa: tlogin.py, /tb/nonce, /tb/login). Token faqat shu brauzerda saqlanadi.
//  - Ma'lumot: GET /tb/biz?since=… (X-TB-Dev: token). Telegram Business uchun foydalanuvchida Telegram Premium bo'lishi kerak.
import rootScope from '@lib/rootScope';
import {keyOf, mergeBiz} from './core';
import type {BizItem} from './core';
import {refreshGhosts, serverUrl, store, watching} from './hooks';

const LS_K = 'toza_sharpa_k', LS_SINCE = 'toza_biz_since', LS_BOT = 'toza_sharpa_bot';
const PULL_MS = 60_000;
const ls = {
  get: (k: string) => { try { return localStorage.getItem(k) || ''; } catch{ return ''; } },
  set: (k: string, v: string) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch{ /* xotira yopiq */ } }
};

export type BizState = {linked: boolean; connected?: boolean; bot?: string; lastPull?: number; added?: number; error?: string};
export const bizState: BizState = {linked: !!ls.get(LS_K), bot: ls.get(LS_BOT) || undefined};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api(path: string, init: RequestInit = {}) {
  const url = serverUrl();
  if(!url) throw new Error('no_server');
  const r = await fetch(url + path, {...init, cache: 'no-store'});
  return r;
}

/** Bir bosishda ulash. Botga `/start toza_…` xabari ketadi (bot javob bermaydi). */
export async function connectSharpa(): Promise<void> {
  const r = await api('/tb/nonce', {method: 'POST'});
  if(!r.ok) throw new Error('nonce_' + r.status);
  const {nonce, bot} = await r.json();
  if(!nonce || !bot) throw new Error('nonce');
  const mgr = (rootScope as any).managers;
  const peer: any = await mgr.appUsersManager.resolveUsername(String(bot).replace(/^@/, ''));
  const botId = peer?.id;
  if(!botId) throw new Error('no_bot');
  await mgr.appMessagesManager.startBot(botId, undefined, 'toza_' + nonce);
  for(let i = 0; i < 40; i++) {                                          // ~60 soniya
    await sleep(1500);
    const res = await api('/tb/login', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({nonce})});
    if(res.status === 202) continue;
    if(!res.ok) throw new Error('login_' + res.status);
    const {k} = await res.json();
    if(!k) throw new Error('login');
    ls.set(LS_K, k); ls.set(LS_BOT, String(bot)); ls.set(LS_SINCE, '');
    Object.assign(bizState, {linked: true, bot: String(bot), error: ''});
    await pullBiz();
    return;
  }
  throw new Error('timeout');
}

export function disconnectSharpa() {
  ls.set(LS_K, ''); ls.set(LS_SINCE, '');
  Object.assign(bizState, {linked: false, connected: undefined, error: ''});
}

let pulling: Promise<number> | null = null;
/** Sharpa'dan yangi o'zgarishlarni oladi. Qaytaradi: arxivga qo'shilgan/yangilangan yozuvlar soni. */
export function pullBiz(): Promise<number> {
  pulling ||= (async() => {
    const k = ls.get(LS_K);
    if(!k) return 0;
    let added = 0;
    try {
      for(let round = 0; round < 10; round++) {
        const since = Number(ls.get(LS_SINCE)) || 0;
        const r = await api('/tb/biz?since=' + since, {headers: {'X-TB-Dev': k}});
        if(r.status === 403) { disconnectSharpa(); bizState.error = 'denied'; return added; }
        if(!r.ok) throw new Error('biz_' + r.status);
        const d: {connected: boolean; bot: string; items: BizItem[]; more: boolean} = await r.json();
        Object.assign(bizState, {connected: d.connected, bot: d.bot || bizState.bot, error: ''});
        let top = since;
        const now = Date.now();
        for(const it of d.items || []) {
          top = Math.max(top, it.deleted || 0, it.edited || 0);
          const rec = mergeBiz(await store.get(keyOf(String(it.chat), it.mid)), it, now);
          if(rec) { await store.put(rec, true); added++; }
        }
        if(top > since) ls.set(LS_SINCE, String(top));
        if(!d.more) break;
      }
    } catch(e: any) {
      bizState.error = String(e?.message || e);
    } finally {
      Object.assign(bizState, {lastPull: Date.now(), added});
    }
    if(added) refreshGhosts();
    return added;
  })().finally(() => { pulling = null; });
  return pulling;
}

let started = false;
export function startBiz() {
  if(started) return;
  started = true;
  const tick = () => { if(!document.hidden && watching() && ls.get(LS_K)) pullBiz(); };
  tick();
  window.setInterval(tick, PULL_MS);
  document.addEventListener('visibilitychange', tick);
}
