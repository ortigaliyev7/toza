// Ko'z asrash rejimi: butun ilova ustiga bosilmaydigan iliq (sarg'ish) va xira qatlam.
// Ko'k nurni kamaytiradi va tunda ekranni yumshatadi. Doim yoki faqat kechqurun (soat oralig'i).
import {eyeCareActive, eyeCareLayers} from './tools-core';
import type {EyeCare} from './tools-core';

const LS = 'toza_eyecare';
const DEF: EyeCare = {mode: 'off', warm: 2, dim: 0, from: 21, to: 7};
export const eyeCare = (): EyeCare => { try { return {...DEF, ...JSON.parse(localStorage.getItem(LS) || '{}')}; } catch{ return DEF; } };
export function setEyeCare(p: Partial<EyeCare>) {
  try { localStorage.setItem(LS, JSON.stringify({...eyeCare(), ...p})); } catch{ /* xotira yopiq */ }
  applyEyeCare();
}

let el: HTMLElement | null = null;
export function applyEyeCare() {
  const c = eyeCare();
  if(!eyeCareActive(c, new Date().getHours())) { el?.remove(); el = null; return; }
  if(!el) {
    el = document.createElement('div');
    el.className = 'tz-eyecare';
    el.setAttribute('aria-hidden', 'true');
    el.append(document.createElement('i'));
  }
  if(!el.isConnected) document.documentElement.append(el);
  const {warm, dim} = eyeCareLayers(c);
  el.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:2147483600;background:${warm};mix-blend-mode:multiply;transition:background .4s;`;
  (el.firstChild as HTMLElement).style.cssText = `position:fixed;inset:0;pointer-events:none;background:rgba(0,0,0,${dim});`;
}

let started = false;
export function startEyeCare() {
  if(started) return;
  started = true;
  applyEyeCare();
  window.setInterval(applyEyeCare, 60 * 1000);             // tungi rejim soatiga qarab yoqiladi/o'chadi
  document.addEventListener('visibilitychange', () => { if(!document.hidden) applyEyeCare(); });
}
