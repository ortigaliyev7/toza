// Bosh ekrandagi (chatlar ro'yxati tepasida) ko'rinmas rejim tezkor tugmalari: yashirin o'qish, yashirin hikoya, offlayn.
// tweb DOM: chatlar ro'yxati ustidagi `.chatlist-overlay` panelining boshiga qo'yiladi (tweb'ning o'z elementlariga tegmaydi).
import {icon} from './icons';
import {ensureStyle} from './style';
import {getFlags, setFlags} from './prefs';
import type {TozaFlags} from './flags';
import {notice} from './alerts';

export const FLAGS_EVENT = 'toza-flags';
const CHIPS: {k: keyof TozaFlags; ic: string; label: string; title: string; on: string; off: string}[] = [
  {k: 'noRead', ic: 'read', label: 'O\'qildi', title: 'Yashirin o\'qish: «o\'qildi» yubormaslik', on: '«O\'qildi» yuborilmaydi', off: '«O\'qildi» yana yuboriladi'},
  {k: 'noStoryView', ic: 'story', label: 'Hikoya', title: 'Hikoyani bildirmay ko\'rish', on: 'Hikoyalarni bildirmay ko\'rasiz', off: 'Hikoya ko\'rilgani yana bildiriladi'},
  {k: 'noOnline', ic: 'ghost', label: 'Offlayn', title: 'Doim «offlayn» ko\'rinish', on: 'Siz doim «offlayn» ko\'rinasiz', off: '«Onlayn» holati yana ko\'rinadi'}
];

let bar: HTMLElement | null = null;
function paint() {
  if(!bar) return;
  const f = getFlags();
  bar.querySelectorAll<HTMLElement>('[data-k]').forEach((b) => {
    const on = !!f[b.dataset.k as keyof TozaFlags];
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  });
}

function build(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'tz-quick';
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', 'Ko\'rinmas rejim');
  for(const c of CHIPS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.k = c.k;
    b.title = c.title;
    b.setAttribute('aria-label', c.title);
    const t = document.createElement('span'); t.textContent = c.label;
    b.append(icon(c.ic, 18), t);
    b.onclick = async() => {
      const next = !getFlags()[c.k];
      await setFlags({[c.k]: next});
      paint();
      window.dispatchEvent(new Event(FLAGS_EVENT));
      notice('Toza', next ? c.on : c.off);
    };
    el.append(b);
  }
  return el;
}

/** Tugmalar qatorini joyiga qo'yadi: chatlar ro'yxati ustidagi panel (`.chatlist-overlay`) ning eng tepasiga,
 *  papkalar qatoridan oldin. Bu panel hikoyalar (stories) ochilib-yopilganda ular bilan birga siljiydi va
 *  tweb ro'yxatni uning balandligiga qarab pastga suradi. Avval tugmalar sarlavhadan keyin turardi va tweb
 *  hikoyalarni qayta chizganda hikoyalar tugmalar ustiga chiqib, pastda bo'sh joy qolardi. */
const OVERLAY = '#column-left .item-main .connection-status-bottom > .chatlist-overlay';
export function mountQuickBar() {
  ensureStyle();
  window.addEventListener(FLAGS_EVENT, paint);
  let watched: Element | null = null;
  const mo = new MutationObserver(() => place());
  const place = () => {
    const overlay = document.querySelector(OVERLAY);
    if(!overlay) return;
    if(overlay !== watched) { mo.disconnect(); watched = overlay; mo.observe(overlay, {childList: true}); }
    if(bar && overlay.firstElementChild === bar) return;
    bar ||= build();
    overlay.prepend(bar);
    paint();
  };
  place();
  new MutationObserver(() => place()).observe(document.getElementById('column-left') || document.body, {childList: true, subtree: false});
  [500, 1500, 4000].forEach((ms) => setTimeout(place, ms));
}
