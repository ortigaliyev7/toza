// Profil dizayni: ism rangi va profil (muqova) rangi. Telegram Web K'da bu oyna yo'q, telefondagi Telegram'dagidek shu yerdan tanlanadi.
// Ranglar ro'yxati Telegram serveridan olinadi (help.getPeerColors / getPeerProfileColors); profil rangi va ko'p ism ranglari Premium talab qiladi.
// tweb tomoni: patches/0002-toza-ghost.patch → appUsersManager.tozaUpdateColor.
import rootScope from '@lib/rootScope';
import {ensureStyle} from './style';

type Opt = {id: number; colors: number[]; bg?: number[]};
const hex = (n: number) => '#' + (n >>> 0).toString(16).padStart(6, '0').slice(-6);
const night = () => document.documentElement.classList.contains('night');
const h = (tag: string, cls = '', ...kids: (Node | string)[]) => { const el = document.createElement(tag); if(cls) el.className = cls; kids.forEach((k) => el.append(k)); return el; };

function options(res: any, profile: boolean): Opt[] {
  return (res?.colors || []).filter((o: any) => !o.pFlags?.hidden).map((o: any) => {
    const set = (night() && o.dark_colors) || o.colors;
    return profile ? {id: o.color_id, colors: set?.palette_colors || [], bg: set?.bg_colors || []} : {id: o.color_id, colors: set?.colors || []};
  }).filter((o: Opt) => o.colors.length);
}
const swatch = (o: Opt) => {
  const c = o.colors.map(hex);
  return c.length === 1 ? c[0] : c.length === 2 ? `linear-gradient(135deg, ${c[0]} 50%, ${c[1]} 50%)` : `conic-gradient(${c[0]} 0 50%, ${c[1]} 0 75%, ${c[2]} 0)`;
};

/** Ism va profil rangini tanlash oynasining ichi. `onDone` — saqlagandan keyin. */
export async function profileDesignView(note: (t: string, color?: string) => HTMLElement): Promise<HTMLElement> {
  ensureStyle();
  const mgr = (rootScope as any).managers;
  const wrap = h('div', 'tz-design');
  const [nameRes, profRes, self] = await Promise.all([
    mgr.apiManager.getPeerColors().catch((): any => null),
    mgr.apiManager.getPeerProfileColors().catch((): any => null),
    mgr.appUsersManager.getSelf()
  ]);
  const names = options(nameRes, false), profs = options(profRes, true);
  if(!names.length && !profs.length) { wrap.append(note('Ranglar ro\'yxatini olib bo\'lmadi. Internetni tekshiring.', 'var(--danger-color)')); return wrap; }

  const start = {name: self?.color?.color as number | undefined, prof: self?.profile_color?.color as number | undefined};
  const cur = {...start};
  const full = [self?.first_name, self?.last_name].filter(Boolean).join(' ') || 'Siz';

  // ---- ko'rinish namunasi
  const cover = h('div', 'tz-design-cover');
  const av = h('div', 'tz-design-av', (full.trim()[0] || '?').toUpperCase());
  const nm = h('div', 'tz-design-name', full); nm.dir = 'auto';
  const reply = h('div', 'tz-design-reply', h('b', '', full), h('span', '', 'Javob shunday ko\'rinadi'));
  cover.append(av, nm);
  wrap.append(cover, reply);

  const paint = () => {
    const p = profs.find((o) => o.id === cur.prof), n = names.find((o) => o.id === cur.name) || names[0];
    cover.style.background = p?.bg?.length ? `linear-gradient(180deg, ${p.bg.map(hex).join(', ')})` : 'var(--primary-color)';
    av.style.background = p?.colors?.[0] ? hex(p.colors[0]) : 'rgba(255,255,255,.25)';
    const nc = n?.colors?.[0] !== undefined ? hex(n.colors[0]) : 'var(--primary-color)';
    reply.style.setProperty('--tz-nc', nc);
    reply.style.background = n && n.colors.length > 1 ? `linear-gradient(90deg, ${hex(n.colors[0])}22, transparent)` : '';
    wrap.querySelectorAll<HTMLElement>('[data-k]').forEach((b) => {
      const on = (b.dataset.k === 'name' ? cur.name : cur.prof) === (b.dataset.v === '' ? undefined : Number(b.dataset.v));
      b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on));
    });
    save.disabled = cur.name === start.name && cur.prof === start.prof;
  };

  const grid = (k: 'name' | 'prof', list: Opt[], title: string, none?: string) => {
    const g = h('div', 'tz-design-grid'); g.setAttribute('role', 'radiogroup'); g.setAttribute('aria-label', title);
    if(none) {
      const b = h('button', 'tz-design-sw tz-design-none', '✕') as HTMLButtonElement;
      b.type = 'button'; b.title = none; b.setAttribute('aria-label', none); b.setAttribute('role', 'radio'); b.dataset.k = k; b.dataset.v = '';
      b.onclick = () => { cur[k] = undefined; paint(); };
      g.append(b);
    }
    for(const o of list) {
      const b = h('button', 'tz-design-sw') as HTMLButtonElement;
      b.type = 'button'; b.style.setProperty('--sw', swatch(o)); b.setAttribute('role', 'radio'); b.setAttribute('aria-label', `${title} ${o.id + 1}`);
      b.dataset.k = k; b.dataset.v = String(o.id);
      b.onclick = () => { cur[k] = o.id; paint(); };
      g.append(b);
    }
    return h('div', 'tz-sec', h('b', '', title), g);
  };

  const msg = h('div');
  const save = h('button', 'tz-main', 'Saqlash') as HTMLButtonElement;
  save.type = 'button';
  save.onclick = async() => {
    save.disabled = true; msg.replaceChildren();
    try {
      if(cur.name !== start.name) { await mgr.appUsersManager.tozaUpdateColor(false, cur.name); start.name = cur.name; }
      if(cur.prof !== start.prof) { await mgr.appUsersManager.tozaUpdateColor(true, cur.prof); start.prof = cur.prof; }
      msg.append(note('Saqlandi. Boshqalar ham shu ranglarni ko\'radi.', 'var(--green-color, #2e9e5b)'));
    } catch(e: any) {
      const t = e?.type || e?.message || String(e);
      msg.append(note(/PREMIUM/.test(t) ? 'Bu rang uchun Telegram Premium kerak. Premium bo\'lsa, Telegram\'dan chiqib qayta kiring va yana urinib ko\'ring.' : 'Saqlab bo\'lmadi: ' + t, 'var(--danger-color)'));
    }
    paint();
  };

  if(names.length) wrap.append(grid('name', names, 'Ism rangi'));
  if(profs.length) wrap.append(grid('prof', profs, 'Profil rangi', 'Profil rangisiz'));
  wrap.append(h('div', 'tz-hint', 'Ism rangi xabarlarda, javoblarda va havolalarda ko\'rinadi. Profil rangi profilingiz tepasini bo\'yaydi (Premium).'), msg, save);
  paint();
  return wrap;
}
