// Aloqa va ilova: Toza ko'prigi, sekin internet rejimi, ilova sifatida o'rnatish, akkauntlarni tez almashtirish.
import {appSettings, setAppSettings} from '@stores/appSettings';
import {unwrap} from 'solid-js/store';
import {hotReloadGuard} from '@lib/solidjs/hotReloadGuardProvider';
import AccountController from '@lib/accounts/accountController';
import {getCurrentAccount} from '@lib/accounts/getCurrentAccount';
import {createProxiedManagersForAccount} from '@lib/getProxiedManagers';
import rootScope from '@lib/rootScope';
import {getInstallPrompt} from '@helpers/dom/installPrompt';
import {featureOn} from './features';
import {looksSlow} from './net-core';

const read = (k: string) => { try { return localStorage.getItem(k); } catch{ return null; } };
const write = (k: string, v: string | null) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch{ /* xotira yopiq */ } };

// ---------------------------------------------------------------- kichik xabar (tugmali)
export function actionToast(text: string, btn?: [string, () => void], ms = 12000) {
  document.querySelector('.tz-ntoast')?.remove();
  const el = document.createElement('div');
  el.className = 'tz-ntoast'; el.setAttribute('role', 'status');
  el.setAttribute('style', 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(76px + env(safe-area-inset-bottom));z-index:99999;display:flex;align-items:center;gap:10px;max-width:min(440px,calc(100vw - 24px));padding:10px 10px 10px 14px;border-radius:16px;background:var(--surface-color,#fff);color:var(--primary-text-color,#000);box-shadow:0 6px 24px rgba(0,0,0,.3);font:500 14px/1.35 var(--font-regular,system-ui,sans-serif);border-left:4px solid var(--primary-color,#3390ec)');
  const t = document.createElement('span'); t.textContent = text; t.style.flex = '1'; el.append(t);
  const mk = (label: string, fn: () => void, main: boolean) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
    b.setAttribute('style', `border:0;border-radius:12px;padding:8px 12px;cursor:pointer;font:700 13px/1 var(--font-regular,system-ui,sans-serif);flex:none;${main ? 'background:var(--primary-color,#3390ec);color:#fff' : 'background:transparent;color:var(--secondary-text-color,#707579)'}`);
    b.onclick = () => { el.remove(); fn(); };
    return b;
  };
  if(btn) el.append(mk(btn[0], btn[1], true));
  el.append(mk('✕', () => undefined, false));
  document.body.append(el);
  setTimeout(() => el.remove(), ms);
}

// ---------------------------------------------------------------- Toza ko'prigi (proksi)
// Brauzer MTProto proksiga (TCP) ulana olmaydi, shuning uchun proksi o'rnida Toza serverining o'zi ishlatiladi:
// ulanish shifrlangan holda (MTProto) Toza serveri orqali Telegram'ga boradi, server ichini o'qiy olmaydi. nginx: /tzws/.
export const bridgeOn = () => read('toza_bridge') === '1';
export function setBridge(on: boolean) {
  write('toza_bridge', on ? '1' : null);
  location.reload();                                         // ishchi yangi manzil bilan qayta ishga tushishi kerak
}
const directUrl = () => 'wss://kws2.web.telegram.org/apiws';
const bridgeUrl = () => (location.protocol === 'http:' ? 'ws://' : 'wss://') + location.host + '/tzws/kws2/apiws';
/** Ulanishni sinash: ms (ochildi) yoki -1 (ochilmadi). */
export function probe(url: string, timeout = 7000): Promise<number> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    let ws: WebSocket;
    const done = (v: number) => { clearTimeout(tm); try { ws.close(); } catch{ /* yopiq */ } resolve(v); };
    const tm = setTimeout(() => done(-1), timeout);
    try { ws = new WebSocket(url, 'binary'); } catch{ done(-1); return; }
    ws.onopen = () => done(Math.round(performance.now() - t0));
    ws.onerror = () => done(-1);
  });
}
export const probeBoth = async() => { const [direct, bridge] = await Promise.all([probe(directUrl()), probe(bridgeUrl())]); return {direct, bridge}; };

/** Ishga tushganda: ko'prik o'chiq, Telegram'ga to'g'ridan ulanib bo'lmasa-yu ko'prik ishlasa — yoqishni taklif qilamiz. */
async function suggestBridge() {
  if(bridgeOn() || !navigator.onLine || read('toza_bridge_asked') === '1') return;
  const {direct, bridge} = await probeBoth();
  if(direct < 0 && bridge >= 0) {
    write('toza_bridge_asked', '1');
    actionToast('Telegram serveriga to\'g\'ridan ulanib bo\'lmayapti. Toza ko\'prigi orqali ulanaymi? (VPN kerak emas)', ['Yoqish', () => setBridge(true)], 20000);
  }
}

// ---------------------------------------------------------------- sekin internet rejimi
const OFF = {contacts: false, private: false, groups: false, channels: false};
export const slowOn = () => read('toza_slow') === '1';
export const slowAuto = () => read('toza_slow_auto') !== '0';
export const setSlowAuto = (on: boolean) => write('toza_slow_auto', on ? '1' : '0');
export async function setSlow(on: boolean, auto = false) {
  if(on === slowOn()) return;
  const s: any = unwrap(appSettings);
  if(on) {
    write('toza_slow_prev', JSON.stringify({autoDownload: s.autoDownload, lite: s.liteMode?.all, pFlags: s.autoDownloadNew?.pFlags}));
    write('toza_slow', '1'); write('toza_slow_by', auto ? 'auto' : 'user');
    await setAppSettings('autoDownload', {...s.autoDownload, photo: {...OFF}, video: {...OFF}, file: {...OFF}});
    await setAppSettings('autoDownloadNew', 'pFlags', {...(s.autoDownloadNew?.pFlags || {}), video_preload_large: false, audio_preload_next: false} as any);
    await setAppSettings('liteMode', 'all', true);
  } else {
    let prev: any = null;
    try { prev = JSON.parse(read('toza_slow_prev') || 'null'); } catch{ /* buzilgan */ }
    write('toza_slow', null); write('toza_slow_by', null); write('toza_slow_prev', null);
    if(prev?.autoDownload) await setAppSettings('autoDownload', prev.autoDownload);
    if(prev?.pFlags) await setAppSettings('autoDownloadNew', 'pFlags', prev.pFlags);
    await setAppSettings('liteMode', 'all', !!prev?.lite);
  }
}
function watchConnection() {
  const c: any = (navigator as any).connection;
  if(!c?.addEventListener) return;
  const check = () => {
    if(!slowAuto()) return;
    const slow = looksSlow(c);
    if(slow && !slowOn()) { setSlow(true, true); actionToast('Internet sekin: sekin internet rejimi yoqildi (rasm va videolar o\'zi yuklanmaydi).', ['O\'chirish', () => { setSlowAuto(false); setSlow(false); }]); } else if(!slow && slowOn() && read('toza_slow_by') === 'auto') { setSlow(false); actionToast('Internet tezlashdi: oddiy rejimga qaytildi.', undefined, 6000); }
  };
  c.addEventListener('change', check);
  check();
}

// ---------------------------------------------------------------- ilova sifatida o'rnatish (PWA)
export type InstallState = 'installed' | 'prompt' | 'ios' | 'frame' | 'manual';
export function installState(): InstallState {
  if(matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone) return 'installed';
  if(window.parent !== window) return 'frame';
  if(getInstallPrompt()) return 'prompt';
  if(/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  return 'manual';
}
export async function install() { await getInstallPrompt()?.(); }

// ---------------------------------------------------------------- akkauntlar
const userName = (u: any) => [u?.first_name, u?.last_name].filter(Boolean).join(' ') || 'Akkaunt';
export type Acc = {n: number; name: string; cur: boolean};
export async function accounts(): Promise<Acc[]> {
  const cur = getCurrentAccount();
  const out: Acc[] = [];
  for(const n of await AccountController.getAccountNumbers()) {
    let name = '';
    try { name = userName(n === cur ? await (rootScope as any).managers.appUsersManager.getSelf() : await createProxiedManagersForAccount(n).appUsersManager.getSelf()); } catch{ name = 'Akkaunt ' + n; }
    out.push({n, name, cur: n === cur});
  }
  return out;
}
export const switchTo = (n: number) => { if(n !== getCurrentAccount()) (hotReloadGuard as any).switchAccount?.(n); };
const muted = (): number[] => { try { return JSON.parse(read('toza_acc_mute') || '[]'); } catch{ return []; } };
export const accMuted = (n: number) => muted().includes(n);
export function setAccMuted(n: number, on: boolean) { const m = muted().filter((x) => x !== n); if(on) m.push(n); write('toza_acc_mute', JSON.stringify(m)); }
/** Alt+1…Alt+4: shu raqamli akkauntga o'tish (feature `acckeys`). */
function bindAccountKeys() {
  window.addEventListener('keydown', async(e) => {
    if(!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || !/^Digit[1-4]$/.test(e.code) || !featureOn('acckeys')) return;
    const list = await AccountController.getAccountNumbers();
    const n = list[+e.code.slice(5) - 1];
    if(n === undefined) return;
    e.preventDefault();
    switchTo(n);
  });
}

let started = false;
export function startNet() {
  if(started) return;
  started = true;
  try { watchConnection(); } catch{ /* qo'llab-quvvatlanmaydi */ }
  try { bindAccountKeys(); } catch{ /* muhim emas */ }
  setTimeout(() => { suggestBridge().catch((): void => undefined); }, 15000);
}
