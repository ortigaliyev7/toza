// Foydalanish statistikasi (feature `usage`): Toza'da qancha vaqt o'tkazdingiz, nechta xabar yubordingiz/oldingiz,
// kim bilan ko'p yozishasiz, qaysi chatni ko'p ochasiz. Faqat shu brauzerda (localStorage `toza_usage`), hech qayerga yuborilmaydi.
import rootScope from '@lib/rootScope';
import {hotReloadGuard, hotReloadGuardReady} from '@lib/solidjs/hotReloadGuardProvider';
import {featureOn} from './features';
import {peerTitle} from './hooks';
import {bumpChat, bumpDay, emptyUsage, fmtSpent, localDay, pruneUsage, summarizeUsage} from './extras-core';
import type {Usage} from './extras-core';

const LS = 'toza_usage', TICK = 15;
let u: Usage | null = null, dirty = false;
const load = (): Usage => {
  if(u) return u;
  try { const v = JSON.parse(localStorage.getItem(LS) || 'null'); u = v?.days ? {...emptyUsage(), ...v} : emptyUsage(); } catch{ u = emptyUsage(); }
  return u!;
};
const save = () => {
  if(!dirty || !u) return;
  dirty = false;
  try { localStorage.setItem(LS, JSON.stringify(pruneUsage(u))); } catch{ /* xotira to'la */ }
};
export const usageData = () => load();
export function resetUsage() { u = emptyUsage(); dirty = true; save(); }

let started = false;
export async function startUsage() {
  if(started) return;
  started = true;
  const now = () => Math.floor(Date.now() / 1000);
  rootScope.addEventListener('history_append', ({message}: any) => {
    if(!featureOn('usage') || !message?.peerId || message._ !== 'message') return;
    if(message.pFlags?.post && !message.pFlags?.out) return;            // kanal postlari hisobga kirmaydi
    const out = !!message.pFlags?.out, d = load();
    bumpDay(d, localDay(Date.now()), out ? 'o' : 'i');
    bumpChat(d, String(message.peerId), out ? 'o' : 'i', now());
    dirty = true;
  });
  window.setInterval(() => {
    if(!featureOn('usage') || document.hidden) return;
    bumpDay(load(), localDay(Date.now()), 's', TICK); dirty = true;
  }, TICK * 1000);
  window.setInterval(save, 30000);
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => { if(document.hidden) save(); });
  try { await hotReloadGuardReady(); } catch{ /* keyinroq */ }
  for(let i = 0; i < 30; i++) {
    const im = hotReloadGuard.appImManager as any;
    if(im?.addEventListener) {
      im.addEventListener('peer_changed', (chat: any) => {
        if(!featureOn('usage') || !chat?.peerId) return;
        bumpChat(load(), String(chat.peerId), 'n', now()); dirty = true;
      });
      return;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, any> = {}, ...kids: (Node | string)[]) => {
  const el = document.createElement(tag);
  const {style, ...rest} = props;
  Object.assign(el, rest);
  if(style) el.setAttribute('style', style);
  kids.forEach((k) => el.append(k));
  return el;
};
const WD = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];

/** Toza sozlamalari → «Statistika» oynasi. */
export function usageView(note: (t: string, color?: string) => HTMLElement, openArchiveStats: () => void): HTMLElement {
  const box = h('div');
  let days = 7;
  const render = async() => {
    save();
    const s = summarizeUsage(load(), Date.now(), days);
    const since = new Date(load().since * 1000).toLocaleDateString();
    const peak = Math.max(1, ...s.series.map((d) => d.s));
    const bars = h('div', {style: 'display:flex;align-items:flex-end;gap:3px;height:90px;margin:8px 0 2px'},
      ...s.series.map((d) => h('div', {title: `${d.day}: ${fmtSpent(d.s)}, ${d.o} yuborilgan, ${d.i} kelgan`,
        style: `flex:1;background:var(--primary-color,#3390ec);border-radius:4px 4px 0 0;height:${Math.max(3, Math.round(d.s / peak * 90))}px;opacity:${d.s ? 1 : .25}`})));
    const labels = days <= 7 ? h('div', {style: 'display:flex;gap:3px'}, ...s.series.map((d) => h('div', {className: 'tz-sub', style: 'flex:1;text-align:center'}, WD[new Date(d.day + 'T12:00').getDay()]))) : h('div');
    const tile = (v: string, l: string) => h('div', {style: 'flex:1 1 40%;min-width:120px;padding:10px 12px;border-radius:16px;background:var(--background-color,rgba(127,127,127,.1))'},
      h('div', {style: 'font:700 18px/1.2 inherit'}, v), h('div', {className: 'tz-sub'}, l));
    const avg = s.activeDays ? Math.round(s.sec / s.activeDays) : 0;
    const top = h('div', {className: 'tz-sec'}, h('b', {}, 'Ko\'p yozishadiganlar'));
    if(!s.top.length) top.append(h('div', {className: 'tz-hint'}, 'Hozircha ma\'lumot yo\'q.'));
    const maxMsgs = Math.max(1, ...s.top.map((c) => c.o + c.i));
    for(const c of s.top) {
      top.append(h('div', {style: 'padding:8px 0;border-top:1px solid var(--border-color,rgba(127,127,127,.2))'},
        h('div', {style: 'display:flex;justify-content:space-between;gap:8px'}, h('span', {style: 'min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'}, await peerTitle(c.peerId)),
          h('span', {className: 'tz-sub', style: 'flex:none'}, `${c.o} siz · ${c.i} ular`)),
        h('div', {style: `height:4px;border-radius:2px;margin-top:6px;background:var(--primary-color,#3390ec);width:${Math.max(4, Math.round((c.o + c.i) / maxMsgs * 100))}%`})));
    }
    const opened = h('div', {className: 'tz-sec'}, h('b', {}, 'Eng ko\'p ochilgan chatlar'));
    if(!s.topOpened.length) opened.append(h('div', {className: 'tz-hint'}, 'Hozircha ma\'lumot yo\'q.'));
    for(const c of s.topOpened) opened.append(h('div', {className: 'tz-row'}, h('div', {className: 'tz-tx'}, await peerTitle(c.peerId)), h('span', {className: 'tz-sub'}, `${c.n} marta`)));
    const seg = h('div', {className: 'tz-seg'});
    ([[7, '7 kun'], [30, '30 kun'], [90, '90 kun']] as [number, string][]).forEach(([d, l]) => seg.append(h('button', {type: 'button', className: days === d ? 'on' : '', onclick: () => { days = d; render(); }}, l)));
    let armed = false;
    const reset = h('button', {type: 'button', style: 'margin-top:10px'}, 'Statistikani tozalash') as HTMLButtonElement;
    reset.onclick = () => { if(!armed) { armed = true; reset.textContent = 'Rostdanmi? Yana bosing'; return; } resetUsage(); render(); };
    box.replaceChildren(
      featureOn('usage') ? note(`Faqat shu qurilmada, ${since} dan beri yig'ilmoqda. Hech qayerga yuborilmaydi.`) : note('Statistika yig\'ish o\'chiq. Yoqish: Toza sozlamalari → Qo\'shimchalarni yoqish/o\'chirish.', '#d33'),
      seg,
      h('div', {className: 'tz-sec'}, h('b', {}, 'Toza\'da o\'tkazilgan vaqt'), bars, labels),
      h('div', {style: 'display:flex;gap:8px;flex-wrap:wrap;margin-top:12px'},
        tile(fmtSpent(s.sec), `jami, ${days} kunda`), tile(fmtSpent(avg), 'o\'rtacha, faol kunda'),
        tile(String(s.sent), 'xabar yubordingiz'), tile(String(s.recv), 'xabar keldi')),
      top, opened,
      h('div', {className: 'tz-sec', style: 'padding-top:6px'},
        h('div', {className: 'tz-row tz-click', onclick: openArchiveStats}, h('div', {className: 'tz-tx'}, 'Saqlangan xabarlar statistikasi', h('div', {className: 'tz-sub'}, 'O\'chirilgan, tahrirlangan, hajmi, chatlar bo\'yicha')), h('span', {className: 'tz-chev'}, '›')),
        h('div', {className: 'tz-hint'}, 'Toza ochiq turgan vaqtdagi xabarlar hisoblanadi. Kanal postlari kirmaydi.'), reset));
  };
  render();
  return box;
}
