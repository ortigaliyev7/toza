// Yozish maydoni: lotin <-> kirill (Alt+K / Alt+L).
import {cyrillicToLatin, hasCyrillic, isUzbekCyrillic, isUzbekLatin, latinToCyrillic} from './tools-core';

// ---------------------------------------------------------------- yozish maydoni: lotin <-> kirill
const composer = () => document.querySelector('.chat-input [contenteditable="true"], .input-message-input[contenteditable="true"]') as HTMLElement | null;
/** Yozish maydonidagi matnni boshqa yozuvga o'giradi (tweb holatini buzmaslik uchun insertText bilan). Qaytaradi: o'girildimi. */
export function convertComposer(to?: 'cyr' | 'lat'): boolean {
  const el = composer();
  const text = el?.innerText || '';
  if(!el || !text.trim()) return false;
  const dir = to || (hasCyrillic(text) ? 'lat' : 'cyr');
  const out = dir === 'cyr' ? latinToCyrillic(text) : cyrillicToLatin(text);
  if(out === text) return false;
  el.focus();
  document.execCommand('selectAll', false);
  return document.execCommand('insertText', false, out.replace(/\n$/, ''));
}
let keysBound = false;
/** Alt+K — kirillga, Alt+L — lotinga (yozish maydonida). */
export function bindTranslitKeys() {
  if(keysBound) return;
  keysBound = true;
  document.addEventListener('keydown', (e) => {
    if(!e.altKey || e.ctrlKey || e.metaKey || !(e.target as HTMLElement)?.closest?.('.input-message-input, .chat-input')) return;
    const k = e.code === 'KeyK' ? 'cyr' : e.code === 'KeyL' ? 'lat' : '';
    if(!k) return;
    e.preventDefault();
    convertComposer(k);
  }, true);
}


// ---------------------------------------------------------------- doimiy rejimlar (sozlamada tanlanadi)
export type Script = 'off' | 'lat' | 'cyr';
const LS_SHOW = 'toza_script_show', LS_SEND = 'toza_script_send';
const rd = (k: string): Script => { try { const v = localStorage.getItem(k); return v === 'lat' || v === 'cyr' ? v : 'off'; } catch{ return 'off'; } };
export const showScript = () => rd(LS_SHOW);
export const sendScript = () => rd(LS_SEND);
export function setShowScript(v: Script) { try { localStorage.setItem(LS_SHOW, v); } catch{ /* xotira yopiq */ } applyShow(); }
export function setSendScript(v: Script) { try { localStorage.setItem(LS_SEND, v); } catch{ /* xotira yopiq */ } }

// ---- Chatdagi xabarlarni tanlangan yozuvda ko'rsatish (faqat o'zbekcha matn; rus/ingliz o'zgarmaydi). Asl matn saqlanadi: o'chirsa qaytadi.
const originals = new Map<Text, string>();
const SKIP = '.time, .time-inner, a, code, pre, .reply, .name, .peer-title, .tz-x, [data-toza-ghost] .tz-sub';
function textNodes(root: Element): Text[] {
  const out: Text[] = [];
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for(let n = w.nextNode(); n; n = w.nextNode()) {
    const t = n as Text;
    if(t.data.trim() && !(t.parentElement?.closest(SKIP))) out.push(t);
  }
  return out;
}
function convertMessage(el: Element, to: Script) {
  const nodes = textNodes(el);
  // avval asl holiga qaytaramiz (rejim o'zgargan bo'lishi mumkin)
  for(const t of nodes) { const o = originals.get(t); if(o !== undefined) t.data = o; }
  if(to === 'off') return;
  const whole = nodes.map((t) => t.data).join(' ');
  const uz = to === 'lat' ? isUzbekCyrillic(whole) : isUzbekLatin(whole);
  if(!uz) return;
  for(const t of nodes) {
    const next = to === 'lat' ? cyrillicToLatin(t.data) : latinToCyrillic(t.data);
    if(next !== t.data) { if(!originals.has(t)) originals.set(t, t.data); t.data = next; }
  }
}
function applyShow(root: ParentNode = document) {
  const mode = showScript();
  root.querySelectorAll?.('.bubble .message').forEach((m) => convertMessage(m, mode));
  for(const t of [...originals.keys()]) if(!t.isConnected) originals.delete(t);   // xotira o'smasin
}
let obsStarted = false;
function startShowObserver() {
  if(obsStarted) return;
  obsStarted = true;
  let t: number | undefined;
  const pending = new Set<Element>();
  new MutationObserver((muts) => {
    if(showScript() === 'off') return;
    for(const mu of muts) mu.addedNodes.forEach((n) => {
      if(n.nodeType === 3) { const m = (n as Text).parentElement?.closest('.bubble .message'); if(m && !originals.has(n as Text)) pending.add(m); return; }
      if(n.nodeType !== 1) return;
      const el = n as Element;
      if(el.matches('.bubble, .bubble .message')) pending.add(el);
      else el.querySelectorAll?.('.bubble').forEach((b) => pending.add(b));
    });
    if(!pending.size) return;
    clearTimeout(t);
    t = window.setTimeout(() => { const list = [...pending]; pending.clear(); list.forEach((el) => applyShow(el.matches('.bubble .message') ? el.parentElement || el : el)); }, 120);
  }).observe(document.body, {childList: true, subtree: true});
}

// ---- Yuborishda avtomatik o'girish: Enter yoki yuborish tugmasi bosilganda, tweb matnni o'qishidan oldin.
function hasRich(el: HTMLElement) { return !!el.querySelector('img, a, .custom-emoji, [data-entity-type], .emoji'); }
function autoConvertBeforeSend() {
  const mode = sendScript();
  if(mode === 'off') return;
  const el = composer();
  const text = el?.innerText || '';
  if(!el || !text.trim() || hasRich(el)) return;                  // havola, emoji yoki formatlash bo'lsa — tegmaymiz
  if(mode === 'lat' ? hasCyrillic(text) && isUzbekCyrillic(text) : isUzbekLatin(text)) convertComposer(mode);
}
let sendBound = false;
function bindAutoSend() {
  if(sendBound) return;
  sendBound = true;
  document.addEventListener('keydown', (e) => {
    if(e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || e.isComposing) return;
    if(!(e.target as HTMLElement)?.closest?.('.input-message-input')) return;
    autoConvertBeforeSend();
  }, true);
  const onBtn = (e: Event) => { if((e.target as HTMLElement)?.closest?.('.btn-send.send, .btn-send:not(.record)')) autoConvertBeforeSend(); };
  document.addEventListener('pointerdown', onBtn, true);
  document.addEventListener('mousedown', onBtn, true);
}

/** Hammasini bir marta yoqadi (Toza ishga tushganda). */
export function startScriptModes() {
  bindAutoSend();
  startShowObserver();
  if(showScript() !== 'off') applyShow();
}
