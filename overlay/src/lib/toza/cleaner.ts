// Ommaviy tozalash oynasi (kontaktlar, kanal va guruhlar uchun umumiy): toifa tugmalari, qidiruv, saralash,
// tez belgilash (bosib turish → belgilash rejimi, barmoqni surib ketma-ket belgilash, «hammasi») va tasdiqlab bajarish.
import {ensureStyle} from './style';
import {icon} from './icons';

export type CleanerItem = {id: string; name: string};
export type CleanerConfig<T extends CleanerItem, F extends string, S extends string> = {
  title: string;
  placeholder: string;
  noun: string;                                         // «kontakt», «chat»
  filters: [F, string][];
  sorts: [S, string][];
  load: () => Promise<T[]>;
  match: (item: T, f: F) => boolean;
  sort: (list: T[], by: S) => T[];
  search: (item: T, q: string) => boolean;
  sub: (item: T) => string;
  badge?: (item: T) => string;                          // o'ngdagi kichik raqam (masalan, o'qilmaganlar)
  hint?: (f: F) => string;
  action: {label: (n: number) => string; confirmTitle: string; confirm: (n: number) => string; yes: (n: number) => string; doing: string; done: (n: number) => string; run: (ids: string[]) => Promise<number>; batch: number};
};

const h = (tag: string, cls = '', ...kids: (Node | string)[]) => { const el = document.createElement(tag); if(cls) el.className = cls; kids.forEach((k) => el.append(k)); return el; };

export async function openCleaner<T extends CleanerItem, F extends string, S extends string>(cfg: CleanerConfig<T, F, S>, onBack?: () => void) {
  ensureStyle();
  const back = h('div', 'tz-back');
  const pop = h('div', 'tz-pop tz-cc');
  back.append(pop);
  document.body.append(back);
  const close = () => back.remove();
  back.addEventListener('mousedown', (e) => { if(e.target === back) close(); });

  let all: T[] = [];
  let filter: F = cfg.filters[0][0], sortBy: S = cfg.sorts[0][0], query = '';
  const selected = new Set<string>();
  let selecting = false;

  const x = h('button', 'tz-x', '✕'); x.onclick = close;
  const head = h('div', 'tz-head', h('b', '', cfg.title), x); head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;';

  const search = h('input') as HTMLInputElement; search.placeholder = cfg.placeholder; search.style.cssText = 'width:calc(100% - 36px);box-sizing:border-box;';
  search.oninput = () => { query = search.value.trim().toLowerCase(); render(); };
  const chips = h('div', 'tz-chips');
  for(const [f, label] of cfg.filters) {
    const b = h('button', '', label) as HTMLButtonElement; b.type = 'button'; b.dataset.f = f;
    b.onclick = () => { filter = f; selected.clear(); selecting = false; render(); };   // ko'rinmay qolgan belgilar bajarilmasin
    chips.append(b);
  }
  const sortBtn = h('button', 'tz-mini') as HTMLButtonElement; sortBtn.type = 'button';
  sortBtn.onclick = () => { const i = cfg.sorts.findIndex(([s]) => s === sortBy); sortBy = cfg.sorts[(i + 1) % cfg.sorts.length][0]; render(); };
  const allBtn = h('button', 'tz-mini') as HTMLButtonElement; allBtn.type = 'button';
  const info = h('div', 'tz-sub');
  const bar = h('div', 'tz-cc-bar', info, sortBtn, allBtn);
  const hint = h('div', 'tz-hint');
  const list = h('div', 'tz-cc-list'); list.setAttribute('role', 'listbox'); list.setAttribute('aria-multiselectable', 'true');
  const act = h('button', 'tz-main tz-cc-del') as HTMLButtonElement; act.type = 'button';
  const msg = h('div', 'tz-sub');
  pop.append(head, search, chips, bar, hint, list, msg, act);
  if(onBack) { const b = h('button', '', 'Orqaga') as HTMLButtonElement; b.onclick = () => { close(); onBack(); }; b.style.cssText = 'margin-top:8px!important;'; pop.append(b); }

  const visible = () => cfg.sort(all.filter((c) => cfg.match(c, filter) && (!query || cfg.search(c, query))), sortBy);

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
    act.textContent = n ? cfg.action.label(n) : 'Belgilang: bosib turing yoki «Hammasini belgilash»';
    act.disabled = !n;
    pop.classList.toggle('selecting', selecting);
  }

  function render() {
    chips.querySelectorAll('button').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.f === filter));
    sortBtn.textContent = 'Saralash: ' + (cfg.sorts.find(([s]) => s === sortBy)?.[1] || '');
    const vis = visible();
    info.textContent = `${vis.length} ta ${cfg.noun}` + (all.length !== vis.length ? ` (jami ${all.length})` : '');
    hint.textContent = cfg.hint?.(filter) || '';
    hint.hidden = !hint.textContent;
    list.replaceChildren();
    if(!vis.length) list.append(h('div', 'tz-sub', `Bu toifada ${cfg.noun} yo'q.`));
    for(const c of vis.slice(0, 1500)) {
      const av = h('span', 'tz-cc-av', (c.name.trim()[0] || '?').toUpperCase());
      const check = h('span', 'tz-cc-ck'); check.append(icon('check', 16));
      const name = h('span', 'tz-cc-name', c.name); name.dir = 'auto';
      const tx = h('div', 'tz-tx', name, h('div', 'tz-sub', cfg.sub(c)));
      const badge = cfg.badge?.(c);
      const row = h('div', 'tz-row tz-cc-row', av, tx, ...(badge ? [h('span', 'tz-cc-badge', badge)] : []), check);
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

  // ---- bajarish: tasdiqlash oynasi, keyin bo'lib-bo'lib
  act.onclick = () => {
    if(!selected.size) return;
    const vis = new Set(visible().map((c) => c.id));
    const ids = [...selected].filter((id) => vis.has(id));                 // faqat ekranda ko'rinib turganlar
    if(!ids.length) return;
    const sheet = h('div', 'tz-sec tz-cc-confirm');
    const yes = h('button', 'tz-main tz-danger', cfg.action.yes(ids.length)) as HTMLButtonElement;
    const no = h('button', '', 'Bekor qilish') as HTMLButtonElement;
    sheet.append(h('b', '', cfg.action.confirmTitle), h('div', 'tz-sub', cfg.action.confirm(ids.length)), yes, no);
    act.replaceWith(sheet);
    sheet.scrollIntoView({block: 'nearest'});
    no.onclick = () => sheet.replaceWith(act);
    yes.onclick = async() => {
      yes.disabled = no.disabled = true;
      let done = 0;
      try {
        for(let i = 0; i < ids.length; i += cfg.action.batch) {
          const part = ids.slice(i, i + cfg.action.batch);
          done += await cfg.action.run(part);
          yes.textContent = `${cfg.action.doing} ${done}/${ids.length}`;
        }
        msg.textContent = cfg.action.done(done);
      } catch(err: any) {
        msg.textContent = `${done} tasi bajarildi, qolganida xato: ${err?.type || err?.message || err}`;
      }
      const gone = new Set(ids.slice(0, done));
      all = all.filter((c) => !gone.has(c.id));
      selected.clear(); selecting = false;
      sheet.replaceWith(act);
      render();
    };
  };

  list.append(h('div', 'tz-sub', 'Yuklanmoqda…'));
  try { all = await cfg.load(); render(); } catch(e: any) { list.replaceChildren(h('div', 'tz-sub', 'Ro\'yxatni olib bo\'lmadi: ' + (e?.type || e?.message || e))); }
}
