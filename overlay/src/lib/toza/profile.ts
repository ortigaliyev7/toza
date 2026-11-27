import {alertsOn} from './alerts';
import {applyProfileTheme, counts, getProfile, isEnabled, isPaid, serverStatus, setProfile, startTozaBackup} from './hooks';
import {ensureStyle} from './style';

const ACCENTS = ['', '#3390ec', '#2a9d4b', '#e8832a', '#d6409f', '#7a5af8', '#d33a3a', '#12a3a8'];
const EMOJIS = ['', '😀', '😎', '🚀', '🔥', '🌙', '⭐', '🎧', '💼', '🌿'];
const fmtSize = (n: number) => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.ceil(n / 1024) + ' KB';

const h = (tag: string, cls = '', ...kids: (Node | string)[]) => { const e = document.createElement(tag); if(cls) e.className = cls; kids.forEach((k) => e.append(k)); return e; };

/** Toza profili: Toza holati, shaxsiy status/bezak, chatlar boshqaruvi, xavfsizlik tarixi. Tashqi servisga ulanmaydi. Stil: style.ts (Telegram uslubi). */
export function openTozaProfile() {
  startTozaBackup();
  ensureStyle();
  const back = h('div', 'tz-back');
  const panel = h('div', 'tz-pop');
  back.append(panel);
  const close = () => back.remove();
  back.addEventListener('mousedown', (e) => { if(e.target === back) close(); });
  document.body.append(back);
  const btn = (t: string, fn: () => any, main = false) => { const b = h('button', main ? 'tz-main' : '', t) as HTMLButtonElement; b.onclick = fn; return b; };
  const go = (view?: 'chats' | 'history') => { close(); import('./ui').then((m) => m.openTozaBackup(undefined, view)); };
  const sec = (title: string, ...k: (Node | string)[]) => h('div', 'tz-sec', h('b', '', title), ...k);
  const line = (ic: string, text: string, sub = '') => h('div', 'tz-row', h('span', 'tz-ic', ic), h('div', '', text, ...(sub ? [h('div', 'tz-sub', sub)] : [])));

  const p = getProfile();
  const avatar = h('div', '', p.emoji || '🙂');
  avatar.setAttribute('style', 'width:64px;height:64px;border-radius:50%;background:var(--primary-color,#3390ec);color:#fff;display:flex;align-items:center;justify-content:center;font-size:32px;flex:none;box-shadow:0 8px 18px rgba(70,80,200,.3),inset 0 1px 0 rgba(255,255,255,.4);');
  const statusLine = h('div', 'tz-sub', p.status || 'Status yozilmagan');
  const top = h('div', 'tz-head');
  top.setAttribute('style', 'display:flex;align-items:center;gap:14px;');
  const x = h('button', 'tz-x', '✕'); x.onclick = close;
  const who = h('div', ''); who.setAttribute('style', 'flex:1;min-width:0');
  who.append(h('b', '', 'Toza profilim'), statusLine);
  top.append(avatar, who, x);

  const stat = h('div');
  const refresh = async() => {
    const rows: Node[] = [
      isEnabled() ? line('✅', 'Zaxira yoqilgan') : line('⚪', 'Zaxira o\'chiq', 'Menyudan «Toza zaxira» orqali yoqing'),
      localStorage.getItem('toza_lock') ? line('🔒', 'PIN qulf yoqilgan') : line('🔓', 'PIN qulf yoqilmagan'),
      alertsOn() ? line('🔔', 'O\'chirilgan va tahrirlangan haqida xabar') : line('🔕', 'Xabar berish o\'chiq'),
      isPaid() ? line('⭐', 'Obuna ulangan', 'Rasm, video, ovoz, hujjat va boshqa fayllar ham saqlanadi') : line('📝', 'Faqat matn saqlanadi')
    ];
    stat.replaceChildren(...rows);
    if(isEnabled()) {
      try {
        const c = await counts();
        stat.append(line('💬', `${c.total} ta xabar saqlangan`, `o'chirilgan: ${c.deleted}`));
        const s = await serverStatus();
        if(s) stat.append(line('💾', `Serverda ${fmtSize(s.used)}`, `${fmtSize(s.quota)} dan`));
      } catch{ /* server javob bermasa ham profil ochiladi */ }
    }
  };

  const statusIn = h('input') as HTMLInputElement;
  statusIn.setAttribute('style', 'width:100%;box-sizing:border-box;background:transparent;color:inherit;font:inherit;margin:6px 0;');
  statusIn.placeholder = 'Shaxsiy status (masalan: Band, ishlayapman)'; statusIn.maxLength = 70; statusIn.value = p.status;
  let emoji = p.emoji, accent = p.accent;
  const chips = (items: string[], cur: () => string, pick: (v: string) => void, render: (v: string, el: HTMLElement) => void) => {
    const wrap = h('div'); wrap.setAttribute('style', 'display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 10px;');
    const paint = () => [...wrap.children].forEach((c, i) => ((c as HTMLElement).style.outline = items[i] === cur() ? '3px solid var(--ac)' : 'none'));
    items.forEach((v) => {
      const c = h('button'); c.setAttribute('style', 'width:38px;height:38px;border-radius:50%!important;border:0;cursor:pointer;font-size:19px;padding:0!important;outline-offset:2px;');
      render(v, c); c.onclick = () => { pick(v); paint(); }; wrap.append(c);
    });
    paint();
    return wrap;
  };
  const emojiRow = chips(EMOJIS, () => emoji, (v) => { emoji = v; avatar.textContent = v || '🙂'; }, (v, el) => { el.textContent = v || '∅'; });
  const accentRow = chips(ACCENTS, () => accent, (v) => { accent = v; }, (v, el) => { el.style.setProperty('background', v || 'var(--primary-color,#3390ec)', 'important'); el.style.color = '#fff'; el.textContent = v ? '' : '∅'; });
  const msg = h('div', 'tz-sub');
  const save = btn('Saqlash', () => { setProfile({status: statusIn.value.trim(), emoji, accent}); statusLine.textContent = statusIn.value.trim() || 'Status yozilmagan'; applyProfileTheme(); msg.textContent = 'Saqlandi'; }, true);
  const acts = h('div'); acts.setAttribute('style', 'display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;');
  acts.append(btn('Chatlar boshqaruvi', () => go('chats')), btn('Xavfsizlik tarixi', () => go('history')), btn('Zaxira va qulf', () => go()));
  const saveRow = h('div'); saveRow.setAttribute('style', 'display:flex;align-items:center;gap:12px;');
  saveRow.append(save, msg);

  panel.append(
    top,
    sec('Toza holati', stat),
    sec('Status va bezak', statusIn, h('div', 'tz-sub', 'Belgi'), emojiRow, h('div', 'tz-sub', 'Rang mavzusi'), accentRow, saveRow, h('div', 'tz-sub', 'Faqat shu brauzerda saqlanadi, boshqalarga ko\'rinmaydi.')),
    sec('Boshqaruv', acts)
  );
  refresh();
}
