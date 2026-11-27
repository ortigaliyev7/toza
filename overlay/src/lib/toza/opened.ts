// Qaysi kanal/guruh qachon ochilganini eslab borish (faqat shu brauzerda). Telegram buni saqlamaydi,
// shuning uchun «uzoq vaqt ochilmagan» toifasi Toza kuzatuvni boshlagan kundan aniqroq bo'lib boradi.
import {hotReloadGuard, hotReloadGuardReady} from '@lib/solidjs/hotReloadGuardProvider';

const LS = 'toza_opened', LS_SINCE = 'toza_opened_since';
const now = () => Math.floor(Date.now() / 1000);
export function openedMap(): Record<string, number> { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch{ return {}; } }
export const trackSince = () => { try { return +(localStorage.getItem(LS_SINCE) || 0); } catch{ return 0; } };

function record(peerId: number | string) {
  if(!peerId || Number(peerId) > 0) return;                         // faqat kanal va guruhlar
  try {
    const m = openedMap();
    m[String(peerId)] = now();
    localStorage.setItem(LS, JSON.stringify(m));
  } catch{ /* xotira yopiq */ }
}

let started = false;
export async function startOpenTracking() {
  if(started) return;
  started = true;
  try { if(!localStorage.getItem(LS_SINCE)) localStorage.setItem(LS_SINCE, String(now())); } catch{ /* xotira yopiq */ }
  try { await hotReloadGuardReady(); } catch{ /* keyinroq */ }
  for(let i = 0; i < 30; i++) {                                     // appImManager ilova to'liq yuklangach paydo bo'ladi
    const im = hotReloadGuard.appImManager as any;
    if(im?.addEventListener) { im.addEventListener('peer_changed', (chat: any) => record(chat?.peerId)); return; }
    await new Promise((r) => setTimeout(r, 2000));
  }
}
