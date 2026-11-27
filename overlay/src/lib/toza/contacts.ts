// Kontaktlarni tozalash: toifa bo'yicha saralash (uzoq kirmagan, o'chirilgan akkaunt, chat yo'q, raqamsiz), tez belgilash
// (bosib turish → belgilash rejimi, barmoqni surib ketma-ket belgilash, «hammasi»), tasdiqlab birdaniga o'chirish.
// Faqat Telegram kontaktlar ro'yxatidan o'chiriladi: chatlar va xabarlar qoladi.
import rootScope from '@lib/rootScope';
import {ensureStyle} from './style';
import {icon} from './icons';
import {matchContact, sortContacts} from './tools-core';
import type {ContactFilter, ContactInfo} from './tools-core';

const FILTERS: [ContactFilter, string][] = [
  ['all', 'Hammasi'], ['inactiveMonth', '1 oydan beri kirmagan'], ['inactiveWeek', '1 haftadan beri'], ['deleted', 'O\'chirilgan akkaunt'], ['noChat', 'Chat yo\'q'], ['noPhone', 'Raqamsiz']
];
const BATCH = 100;

const h = (tag: string, cls = '', ...kids: (Node | string)[]) => { const el = document.createElement(tag); if(cls) el.className = cls; kids.forEach((k) => el.append(k)); return el; };

function statusText(c: ContactInfo, now: number): string {
  if(c.deleted) return 'O\'chirilgan akkaunt';
  const s = c.status;
  switch(s?._) {
    case 'userStatusOnline': return 'onlayn';
    case 'userStatusOffline': {
      const d = Math.floor((now - (s.was_online || 0)) / 86400);
      return d < 1 ? 'bugun kirgan' : d < 30 ? `${d} kun oldin` : d < 365 ? `${Math.floor(d / 30)} oy oldin` : `${Math.floor(d / 365)} yil oldin`;
    }
    case 'userStatusRecently': return 'yaqinda';
    case 'userStatusLastWeek': return 'shu hafta';
    case 'userStatusLastMonth': return 'shu oy';
    default: return 'uzoq vaqt oldin';
  }
}

async function loadContacts(): Promise<ContactInfo[]> {
  const mgr = (rootScope as any).managers;
  const ids: (string | number)[] = await mgr.appUsersManager.getContacts(undefined, false, 'none');
  const out: ContactInfo[] = [];
  for(const id of ids) {
    const u = await mgr.appUsersManager.getUser(id);
    if(!u) continue;
    let hasChat = false;
    try { hasChat = !!(await mgr.appMessagesManager.getDialogOnly(Number(u.id)))?.top_message; } catch{ /* yo'q */ }
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || (u.pFlags?.deleted ? 'O\'chirilgan akkaunt' : u.phone ? '+' + u.phone : 'Nomsiz');
    out.push({id: String(u.id), name, phone: u.phone, deleted: !!u.pFlags?.deleted, bot: !!u.pFlags?.bot, status: u.status, hasChat});
  }
  return out;
}

export async function openContactsCleaner(onBack?: () => void) {
  ensureStyle();
  const back = h('div', 'tz-back');
  const pop = h('div', 'tz-pop tz-cc');
  back.append(pop);
  document.body.append(back);
  const close = () => back.remove();
  back.addEventListener('mousedown', (e) => { if(e.target === back) close(); });

  const now = Math.floor(Date.now() / 1000);
  let all: ContactInfo[] = [];
  let filter: ContactFilter = 'all', sortBy: 'name' | 'seen' = 'name', query = '';
  const selected = new Set<string>();
  let selecting = false;

  const title = h('b', '', 'Kontaktlarni tozalash');
  const x = h('button', 'tz-x', '✕'); x.onclick = close;
  const head = h('div', 'tz-head'); head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;';
  head.append(title, x);

  const search = h('input') as HTMLInputElement; search.placeholder = 'Qidirish: ism yoki raqam'; search.style.cssText = 'width:calc(100% - 36px);box-sizing:border-box;';
  search.oninput = () => { query = search.value.trim().toLowerCase(); render(); };
  const chips = h('div', 'tz-chips');
  for(const [f, label] of FILTERS) {
    const b = h('button', '', label) as HTMLButtonElement; b.type = 'button'; b.dataset.f = f;
    b.onclick = () => { filter = f; selected.clear(); selecting = false; render(); };   // ko'rinmay qolgan belgilar o'chirilmasin
    chips.append(b);
  }
  const sortBtn = h('button', 'tz-mini') as HTMLButtonElement; sortBtn.type = 'button';
  sortBtn.onclick = () => { sortBy = sortBy === 'name' ? 'seen' : 'name'; render(); };
  const allBtn = h('button', 'tz-mini') as HTMLButtonElement; allBtn.type = 'button';
  const info = h('div', 'tz-sub');
  const bar = h('div', 'tz-cc-bar'); bar.append(info, sortBtn, allBtn);
  const list = h('div', 'tz-cc-list'); list.setAttribute('role', 'listbox'); list.setAttribute('aria-multiselectable', 'true');
  const del = h('button', 'tz-main tz-cc-del') as HTMLButtonElement; del.type = 'button';
  const msg = h('div', 'tz-sub');
  pop.append(head, search, chips, bar, list, msg, del);
  if(onBack) { const b = h('button', '', 'Orqaga') as HTMLButtonElement; b.onclick = () => { close(); onBack(); }; b.style.cssText = 'margin-top:8px!important;'; pop.append(b); }

  const visible = () => sortContacts(all.filter((c) => matchContact(c, filter, now) && (!query || c.name.toLowerCase().includes(query) || (c.phone || '').includes(query.replace(/\D/g, '') || '\u0000'))), sortBy, now);

  function paintRow(row: HTMLElement, id: string) {
    const on = selected.has(id);
    row.classList.toggle('on', on);
    row.setAttribute('aria-selected', String(on));
  }
  function paintFooter() {
    const vis = visible();
    const allOn = vis.length > 0 && vis.every((c) => selected.has(c.id));
    allBtn.textContent = allOn ? 'Belgini olish' : 'Hammasini belgilash';
    allBtn.onclick = () => { vis.forEach((c) => allOn ? selected.delete(c.id) : selected.add(c.id)); selecting = selected.size > 0; render(); };
    const n = vis.filter((c) => selected.has(c.id)).length;
    del.textContent = n ? `O'chirish (${n})` : 'Belgilang: bosib turing yoki «Hammasini belgilash»';
    del.disabled = !n;
    pop.classList.toggle('selecting', selecting);
  }

  function render() {
    chips.querySelectorAll('button').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.f === filter));
    sortBtn.textContent = sortBy === 'name' ? 'Saralash: ism' : 'Saralash: oxirgi kirgan';
    const vis = visible();
    info.textContent = `${vis.length} ta kontakt` + (all.length !== vis.length ? ` (jami ${all.length})` : '');
    list.replaceChildren();
    if(!vis.length) list.append(h('div', 'tz-sub', 'Bu toifada kontakt yo\'q.'));
    for(const c of vis.slice(0, 1500)) {
      const av = h('span', 'tz-cc-av', (c.name.trim()[0] || '?').toUpperCase());
      const check = h('span', 'tz-cc-ck'); check.append(icon('check', 16));
      const tx = h('div', 'tz-tx', c.name, h('div', 'tz-sub', [statusText(c, now), c.phone ? '+' + c.phone : '', !c.hasChat ? 'chat yo\'q' : ''].filter(Boolean).join(' · ')));
      const row = h('div', 'tz-row tz-cc-row', av, tx, check);
      row.dataset.id = c.id;
      row.setAttribute('role', 'option');
      paintRow(row, c.id);
      list.append(row);
    }
    paintFooter();
  }

  // ---- tez belgilash: bosib turish → belgilash rejimi; rejimda bosish — almashtirish; surib o'tish — ketma-ket belgilash
  let pressTimer: number | undefined, dragMode: boolean | null = null, startY = 0, moved = false, lastId = '';
  const rowAt = (e: PointerEvent) => (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement)?.closest?.('.tz-cc-row') as HTMLElement | null;
  const setSel = (row: HTMLElement, on: boolean) => { const id = row.dataset.id!; on ? selected.add(id) : selected.delete(id); paintRow(row, id); };
  list.addEventListener('pointerdown', (e) => {
    const row = rowAt(e); if(!row) return;
    startY = e.clientY; moved = false; lastId = '';
    clearTimeout(pressTimer);
    pressTimer = window.setTimeout(() => {
      selecting = true; dragMode = !selected.has(row.dataset.id!);
      setSel(row, dragMode); lastId = row.dataset.id!;
      try { navigator.vibrate?.(15); } catch{ /* yo'q */ }
      paintFooter();
    }, 450);
  });
  list.addEventListener('pointermove', (e) => {
    if(Math.abs(e.clientY - startY) > 8) { moved = true; if(dragMode === null) clearTimeout(pressTimer); }
    if(dragMode === null) return;
    e.preventDefault();
    const row = rowAt(e);
    if(row && row.dataset.id !== lastId) { setSel(row, dragMode); lastId = row.dataset.id!; paintFooter(); }
  });
  const end = (e: PointerEvent) => {
    clearTimeout(pressTimer);
    const wasDrag = dragMode !== null;
    dragMode = null;
    if(wasDrag || moved) return;
    const row = rowAt(e); if(!row) return;
    if(selecting) { setSel(row, !selected.has(row.dataset.id!)); if(!selected.size) selecting = false; paintFooter(); }
  };
  list.addEventListener('pointerup', end);
  list.addEventListener('pointercancel', () => { clearTimeout(pressTimer); dragMode = null; });
  list.addEventListener('contextmenu', (e) => e.preventDefault());
  // telefonda: bosib turgandan keyin surish ro'yxatni aylantirmasin, belgilasin
  list.addEventListener('touchmove', (e) => { if(dragMode !== null) e.preventDefault(); }, {passive: false});

  // ---- o'chirish: tasdiqlash oynasi, keyin 100 tadan
  del.onclick = () => {
    if(!selected.size) return;
    const vis = new Set(visible().map((c) => c.id));
    const ids = [...selected].filter((id) => vis.has(id));                 // faqat ekranda ko'rinib turganlar
    if(!ids.length) return;
    const sheet = h('div', 'tz-sec tz-cc-confirm');
    const yes = h('button', 'tz-main tz-danger', `Ha, ${ids.length} ta kontaktni o'chirish`) as HTMLButtonElement;
    const no = h('button', '', 'Bekor qilish') as HTMLButtonElement;
    sheet.append(h('b', '', 'Rostdan o\'chirilsinmi?'), h('div', 'tz-sub', `${ids.length} ta kontakt Telegram kontaktlaringizdan o'chiriladi. Chatlar va xabarlar qoladi. Qaytarish uchun ularni qayta qo'shish kerak bo'ladi.`), yes, no);
    del.replaceWith(sheet);
    no.onclick = () => sheet.replaceWith(del);
    yes.onclick = async() => {
      yes.disabled = no.disabled = true;
      const mgr = (rootScope as any).managers;
      let done = 0;
      try {
        for(let i = 0; i < ids.length; i += BATCH) {
          const part = ids.slice(i, i + BATCH);
          await mgr.appUsersManager.deleteContacts(part.map((id) => (id as any).toUserId?.() ?? Number(id)));
          done += part.length;
          yes.textContent = `O'chirilmoqda… ${done}/${ids.length}`;
        }
        msg.textContent = `${done} ta kontakt o'chirildi.`;
      } catch(err: any) {
        msg.textContent = `${done} ta o'chirildi, qolganida xato: ${err?.type || err?.message || err}`;
      }
      const gone = new Set(ids.slice(0, done));
      all = all.filter((c) => !gone.has(c.id));
      selected.clear(); selecting = false;
      sheet.replaceWith(del);
      render();
    };
  };

  list.append(h('div', 'tz-sub', 'Yuklanmoqda…'));
  try { all = await loadContacts(); render(); } catch(e: any) { list.replaceChildren(h('div', 'tz-sub', 'Kontaktlarni olib bo\'lmadi: ' + (e?.type || e?.message || e))); }
}
