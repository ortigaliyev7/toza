// Tezkor javob shablonlari: yozish maydoni yonidagi tugma (feature `tplbtn`) — bosilganda shablonlar ro'yxati chiqadi,
// tanlangani yozish maydoniga qo'yiladi. Yozilgan matnni ham shu yerdan shablon qilib saqlash mumkin. Faqat shu brauzerda.
import {ensureStyle} from './style';
import {icon} from './icons';
import {featureOn, FEATURES_EVENT} from './features';
import {newTemplate} from './tools-core';
import type {Template} from './tools-core';
import {notice} from './alerts';

const LS_TPL = 'toza_templates';
export const TPL_EVENT = 'toza-templates';
export const loadTpl = (): Template[] => { try { const a = JSON.parse(localStorage.getItem(LS_TPL) || '[]'); return Array.isArray(a) ? a : []; } catch{ return []; } };
export const saveTpl = (l: Template[]) => {
  try { localStorage.setItem(LS_TPL, JSON.stringify(l.slice(0, 50))); } catch{ /* xotira yopiq */ }
  window.dispatchEvent(new Event(TPL_EVENT));
};

const composer = () => document.querySelector('.chat-input [contenteditable="true"], .input-message-input[contenteditable="true"]') as HTMLElement | null;
/** Ochiq chatning yozish maydoniga matn qo'yadi (bo'lmasa false). */
export function insertIntoComposer(text: string): boolean {
  const el = composer();
  if(!el) return false;
  el.focus();
  return document.execCommand('insertText', false, text);
}

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, any> = {}, ...kids: (Node | string)[]) => {
  const el = document.createElement(tag);
  const {style, ...rest} = props;
  Object.assign(el, rest);
  if(style) el.setAttribute('style', style);
  kids.forEach((k) => el.append(k));
  return el;
};

let menu: HTMLElement | null = null;
const closeMenu = () => { menu?.remove(); menu = null; document.removeEventListener('pointerdown', outside, true); };
const outside = (e: Event) => { if(menu && !menu.contains(e.target as Node) && !(e.target as HTMLElement)?.closest?.('.tz-tplbtn')) closeMenu(); };

function openMenu(btn: HTMLElement) {
  if(menu) { closeMenu(); return; }
  ensureStyle();
  const r = btn.getBoundingClientRect();
  menu = h('div', {className: 'tz-tplmenu', role: 'menu'});
  menu.style.bottom = `${Math.max(8, window.innerHeight - r.top + 8)}px`;
  menu.style.left = `${Math.max(8, Math.min(r.left - 8, window.innerWidth - 300))}px`;
  const list = loadTpl();
  const typed = (composer()?.innerText || '').trim();
  menu.append(h('div', {className: 'tz-tplmenu-h'}, 'Shablonlar'));
  if(!list.length) menu.append(h('div', {className: 'tz-tplmenu-empty'}, 'Hozircha yo\'q. Matn yozing va pastdagi «Saqlash»ni bosing yoki Toza sozlamalari → Shablonlar.'));
  for(const t of list) {
    menu.append(h('button', {type: 'button', role: 'menuitem', className: 'tz-tplmenu-i', onclick: () => {
      closeMenu();
      if(!insertIntoComposer(t.text)) navigator.clipboard?.writeText(t.text).catch((): void => undefined);
    }}, h('b', {}, t.title), h('span', {}, t.text)));
  }
  if(typed) {
    menu.append(h('button', {type: 'button', className: 'tz-tplmenu-add', onclick: () => {
      closeMenu();
      if(loadTpl().some((x) => x.text === typed.slice(0, 2000))) { notice('Toza', 'Bu shablon allaqachon bor'); return; }
      saveTpl([...loadTpl(), newTemplate('', typed)]);
      notice('Toza', 'Shablon saqlandi');
    }}, icon('plus', 18), 'Yozilgan matnni shablon qilib saqlash'));
  }
  document.body.append(menu);
  document.addEventListener('pointerdown', outside, true);
}

function mount() {
  if(!featureOn('tplbtn')) return;
  document.querySelectorAll<HTMLElement>('.chat-input .attach-file').forEach((attach) => {
    const parent = attach.parentElement;
    if(!parent || parent.querySelector(':scope > .tz-tplbtn')) return;
    const b = h('button', {type: 'button', className: 'btn-icon tz-tplbtn', title: 'Tezkor javob shablonlari'});
    b.setAttribute('aria-label', 'Tezkor javob shablonlari');
    b.append(icon('chat', 22));
    b.addEventListener('mousedown', (e) => e.preventDefault());       // yozish maydonidan fokus ketmasin
    b.onclick = (e) => { e.stopPropagation(); openMenu(b); };
    attach.before(b);
  });
}

let started = false;
export function startTemplates() {
  if(started) return;
  started = true;
  let t = 0;
  const schedule = () => { if(!t) t = window.setTimeout(() => { t = 0; mount(); }, 300); };
  const col = document.getElementById('column-center') || document.body;
  new MutationObserver(schedule).observe(col, {childList: true, subtree: true});
  mount();
  window.addEventListener(FEATURES_EVENT, (e: Event) => {
    const d = (e as CustomEvent).detail;
    if(d?.k !== 'tplbtn') return;
    if(d.on) mount(); else { closeMenu(); document.querySelectorAll('.tz-tplbtn').forEach((el) => el.remove()); }
  });
  document.addEventListener('keydown', (e) => { if(e.key === 'Escape') closeMenu(); });
}

/** Toza sozlamalari → «Tezkor javob shablonlari» oynasi. */
export function templatesView(note: (t: string, color?: string) => HTMLElement): HTMLElement {
  const wrap = h('div');
  const list = h('div', {className: 'tz-sec'});
  const msg = h('div');
  const render = () => {
    list.replaceChildren(h('b', {}, `Shablonlar (${loadTpl().length}/50)`));
    const all = loadTpl();
    if(!all.length) list.append(h('div', {className: 'tz-hint'}, 'Hozircha shablon yo\'q. Pastdan qo\'shing.'));
    all.forEach((t, i) => {
      const up = h('button', {type: 'button', title: 'Yuqoriga', onclick: () => { const l = loadTpl(); [l[i - 1], l[i]] = [l[i], l[i - 1]]; saveTpl(l); render(); }}, '↑');
      up.disabled = i === 0;
      list.append(h('div', {className: 'tz-row'},
        h('div', {className: 'tz-tx'}, t.title, h('div', {className: 'tz-sub', style: 'white-space:pre-wrap;word-break:break-word'}, t.text)),
        h('div', {style: 'display:flex;gap:6px;flex:none'}, up,
          h('button', {type: 'button', title: 'O\'chirish', onclick: () => { saveTpl(loadTpl().filter((x) => x.id !== t.id)); render(); }}, '✕'))));
    });
  };
  const ttl = h('input', {placeholder: 'Nomi (ixtiyoriy), masalan: Rahmat'}) as HTMLInputElement;
  const txt = h('textarea', {placeholder: 'Matn, masalan: Rahmat, tez orada javob beraman', rows: 3}) as HTMLTextAreaElement;
  ttl.setAttribute('style', 'width:100%;box-sizing:border-box;margin-bottom:8px');
  txt.setAttribute('style', 'width:100%;box-sizing:border-box;resize:vertical');
  const add = h('button', {type: 'button', className: 'tz-main', onclick: () => {
    if(!txt.value.trim()) { msg.replaceChildren(note('Matn yozing.', '#d33')); return; }
    if(loadTpl().length >= 50) { msg.replaceChildren(note('50 tadan ortiq bo\'lmaydi.', '#d33')); return; }
    saveTpl([...loadTpl(), newTemplate(ttl.value, txt.value)]);
    ttl.value = ''; txt.value = ''; msg.replaceChildren(); render();
  }}, 'Qo\'shish');
  wrap.append(
    note('Chatda yozish maydoni yonidagi 💬 tugmani bosing: shablonni tanlasangiz, matn yozish maydoniga tushadi, keyin yuborasiz. Yozib turgan matningizni ham o\'sha yerdan saqlab qo\'yish mumkin.'),
    list,
    h('div', {className: 'tz-sec'}, h('b', {}, 'Yangi shablon'), ttl, txt, h('div', {style: 'margin-top:10px'}, add), msg));
  render();
  return wrap;
}
