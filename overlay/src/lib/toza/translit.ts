// Yozish maydoni: lotin <-> kirill (Alt+K / Alt+L).
import {cyrillicToLatin, hasCyrillic, latinToCyrillic} from './tools-core';

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

