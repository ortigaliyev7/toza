// Profil dizayni (telefondagi Telegram kabi): «Profil | Ism» almashtirgich, tepada katta namuna, ranglar, «Asliga qaytarish», «Uslubni qo'llash».
// Ranglar Telegram serveridan olinadi va Telegram'ning o'ziga saqlanadi (account.updateColor): boshqa har qanday Telegram ilovasida ham ko'rinadi.
// Profil rangi va ko'p ism ranglari Telegram Premium talab qiladi. tweb tomoni: patches/0002-toza-ghost.patch → appUsersManager.tozaUpdateColor.
import rootScope from '@lib/rootScope';
import {ensureStyle} from './style';

type Opt = {id: number; colors: number[]; bg?: number[]};
type Mode = 'prof' | 'name';
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

/** Profil va ism rangini tanlash oynasining ichi. `avatar` — namunadagi rasm (bo'lmasa bosh harf). */
export async function profileDesignView(note: (t: string, color?: string) => HTMLElement, opts: {avatar?: () => HTMLElement} = {}): Promise<HTMLElement> {
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
  let mode: Mode = profs.length ? 'prof' : 'name';

  // ---- almashtirgich
  const seg = h('div', 'tz-design-seg'); seg.setAttribute('role', 'tablist');
  const segBtn = (m: Mode, label: string) => { const b = h('button', '', label) as HTMLButtonElement; b.type = 'button'; b.setAttribute('role', 'tab'); b.dataset.m = m; b.onclick = () => { mode = m; render(); }; seg.append(b); };
  if(profs.length) segBtn('prof', 'Profil');
  if(names.length) segBtn('name', 'Ism');

  // ---- namuna
  const cover = h('div', 'tz-design-cover');
  const av = opts.avatar?.() || h('div', 'tz-design-av', (full.trim()[0] || '?').toUpperCase());
  av.classList.add('tz-design-avatar');
  const nm = h('div', 'tz-design-name', full); nm.dir = 'auto';
  cover.append(seg, av, nm, h('div', 'tz-design-st', 'onlayn'));
  const reply = h('div', 'tz-design-reply', h('b', '', full), h('span', '', 'Javob va havolalar shu rangda ko\'rinadi'));
  const grid = h('div', 'tz-design-grid'); grid.setAttribute('role', 'radiogroup');
  const hint = h('div', 'tz-hint');
  const reset = h('button', 'tz-design-reset') as HTMLButtonElement; reset.type = 'button';
  const msg = h('div');
  const save = h('button', 'tz-main tz-design-apply', 'Uslubni qo\'llash') as HTMLButtonElement; save.type = 'button';
  wrap.append(cover, reply, h('div', 'tz-sec', grid), hint, reset, msg, save);

  const paintPreview = () => {
    const p = profs.find((o) => o.id === cur.prof), n = names.find((o) => o.id === cur.name) || names[0];
    cover.style.background = p?.bg?.length ? `linear-gradient(180deg, ${p.bg.map(hex).join(', ')})` : 'var(--primary-color)';
    const nc = n?.colors?.[0] !== undefined ? hex(n.colors[0]) : 'var(--primary-color)';
    reply.style.setProperty('--tz-nc', nc);
    save.disabled = cur.name === start.name && cur.prof === start.prof;
  };
  function render() {
    seg.querySelectorAll<HTMLElement>('[data-m]').forEach((b) => { const on = b.dataset.m === mode; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
    const list = mode === 'prof' ? profs : names;
    grid.setAttribute('aria-label', mode === 'prof' ? 'Profil rangi' : 'Ism rangi');
    grid.replaceChildren(...list.map((o) => {
      const b = h('button', 'tz-design-sw') as HTMLButtonElement;
      b.type = 'button'; b.style.setProperty('--sw', swatch(o)); b.setAttribute('role', 'radio');
      const on = (mode === 'prof' ? cur.prof : cur.name) === o.id;
      b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); b.setAttribute('aria-label', `Rang ${o.id + 1}`);
      b.onclick = () => { if(mode === 'prof') cur.prof = o.id; else cur.name = o.id; render(); };
      return b;
    }));
    reply.hidden = mode !== 'name';
    hint.textContent = mode === 'prof' ?
      'Profil rangi profilingiz tepasini bo\'yaydi. Telegram Premium kerak. Saqlangach har qanday Telegram ilovasida ko\'rinadi.' :
      'Ism rangi xabarlaringizda, javoblarda va havolalarda ko\'rinadi. Saqlangach har qanday Telegram ilovasida ko\'rinadi.';
    reset.textContent = mode === 'prof' ? 'Profil rangini asliga qaytarish' : 'Ism rangini asliga qaytarish';
    reset.hidden = (mode === 'prof' ? cur.prof : cur.name) === undefined;
    paintPreview();
  }
  reset.onclick = () => { if(mode === 'prof') cur.prof = undefined; else cur.name = undefined; render(); };

  save.onclick = async() => {
    save.disabled = true; msg.replaceChildren();
    try {
      if(cur.name !== start.name) { await mgr.appUsersManager.tozaUpdateColor(false, cur.name); start.name = cur.name; }
      if(cur.prof !== start.prof) { await mgr.appUsersManager.tozaUpdateColor(true, cur.prof); start.prof = cur.prof; }
      msg.append(note('Saqlandi. Endi barcha Telegram ilovalarida shu ranglar ko\'rinadi.', 'var(--green-color, #2e9e5b)'));
    } catch(e: any) {
      const t = e?.type || e?.message || String(e);
      msg.append(note(/PREMIUM/.test(t) ? 'Bu rang uchun Telegram Premium kerak. Premium bo\'lsa, Telegram\'dan chiqib qayta kiring va yana urinib ko\'ring.' : 'Saqlab bo\'lmadi: ' + t, 'var(--danger-color)'));
    }
    render();
  };

  render();
  return wrap;
}
