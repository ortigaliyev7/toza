// Toza animatsiyalari: yangi kelgan xabar, tugmalarni bosish, chatlar ro'yxati, menyu va oynalar.
// Hammasi yengil CSS (faqat transform/opacity), sozlamalarda uslub, tezlik va qaysi joyda ishlashi tanlanadi.
// Telegram'ning «Animatsiyalar o'chiq» (energiya tejash) sozlamasi yoki tizimdagi «harakatni kamaytirish» yoqilgan bo'lsa ishlamaydi.
import rootScope from '@lib/rootScope';
import {ensureStyle} from './style';

export type AnimStyle = 'soft' | 'pop' | 'slide';
export type AnimSpeed = 'slow' | 'normal' | 'fast';
export type AnimPrefs = {on: boolean; style: AnimStyle; speed: AnimSpeed; msg: boolean; btn: boolean; list: boolean; pop: boolean};
const LS = 'toza_anim';
const DEF: AnimPrefs = {on: true, style: 'soft', speed: 'normal', msg: true, btn: true, list: true, pop: true};
const read = (): Partial<AnimPrefs> => { try { return JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch{ return {}; } };
export const animPrefs = (): AnimPrefs => ({...DEF, ...read()});
export function setAnimPrefs(p: Partial<AnimPrefs>) {
  try { localStorage.setItem(LS, JSON.stringify({...animPrefs(), ...p})); } catch{ /* xotira yopiq */ }
  applyAnim();
}

const SPEED: Record<AnimSpeed, number> = {slow: 1.6, normal: 1, fast: 0.6};
const CLASSES = ['tz-an', 'tz-an-soft', 'tz-an-pop', 'tz-an-slide', 'tz-an-msg', 'tz-an-btn', 'tz-an-list', 'tz-an-pop-on'];

export function applyAnim() {
  const p = animPrefs(), root = document.documentElement;
  root.classList.remove(...CLASSES);
  if(!p.on) return;
  ensureStyle();
  root.classList.add('tz-an', 'tz-an-' + p.style);
  if(p.msg) root.classList.add('tz-an-msg');
  if(p.btn) root.classList.add('tz-an-btn');
  if(p.list) root.classList.add('tz-an-list');
  if(p.pop) root.classList.add('tz-an-pop-on');
  root.style.setProperty('--tz-k', String(SPEED[p.speed]));
}

/** Namuna: sozlamalarda tanlangan uslubni ko'rsatish uchun. */
export function previewAnim(el: HTMLElement) {
  el.classList.remove('tz-new');
  void el.offsetWidth;                                     // bir martalik: animatsiyani qaytadan boshlash
  el.classList.add('tz-new');
}

let started = false;
export function startAnim() {
  if(started) return;
  started = true;
  applyAnim();
  // faqat hozir kelgan xabar jonlanadi: chatni ochganda yoki tarixni yuklaganda eski xabarlar tinch turadi
  rootScope.addEventListener('history_append', ({message}: any) => {
    const p = animPrefs();
    if(!p.on || !p.msg || !message?.mid || message.pFlags?.out) return;
    let n = 0;
    const find = () => {
      const b = document.querySelector<HTMLElement>(`.bubbles-inner .bubble[data-mid="${message.mid}"]`);
      if(b) { b.classList.add('tz-new'); setTimeout(() => b.classList.remove('tz-new'), 1500); return; }
      if(++n < 10) requestAnimationFrame(find);
    };
    requestAnimationFrame(find);
  });
}
