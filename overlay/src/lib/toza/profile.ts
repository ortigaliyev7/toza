import {alertsOn} from './alerts';
import {applyProfileTheme, counts, getProfile, isEnabled, isPaid, serverStatus, setProfile, startTozaBackup} from './hooks';

const ACCENTS = ['', '#3390ec', '#2a9d4b', '#e8832a', '#d6409f', '#7a5af8', '#d33a3a', '#12a3a8'];
const EMOJIS = ['', '😀', '😎', '🚀', '🔥', '🌙', '⭐', '🎧', '💼', '🌿'];
const fmtSize = (n: number) => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.ceil(n / 1024) + ' KB';
const BTN = 'border:0;border-radius:10px;padding:10px 14px;font:inherit;font-weight:600;cursor:pointer;background:var(--primary-color,#3390ec);color:#fff;';
const BTN2 = 'border:0;border-radius:10px;padding:10px 14px;font:inherit;font-weight:600;cursor:pointer;background:rgba(127,127,127,.18);color:inherit;';

const h = (tag: string, style = '', ...kids: (Node | string)[]) => { const e = document.createElement(tag); if(style) e.setAttribute('style', style); kids.forEach((k) => e.append(k)); return e; };

/** Toza profili: Toza holati, shaxsiy status/bezak, chatlar boshqaruvi, xavfsizlik tarixi. Hech qanday tashqi servisga ulanmaydi. */
export function openTozaProfile() {
  startTozaBackup();
  const back = h('div', 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:12px;');
  const panel = h('div', 'background:var(--surface-color,#fff);color:var(--primary-text-color,#000);border-radius:16px;max-width:460px;width:100%;max-height:92vh;overflow:auto;padding:18px;box-shadow:0 10px 40px rgba(0,0,0,.35);font-size:15px;line-height:1.4;');
  back.append(panel);
  const close = () => back.remove();
  back.addEventListener('mousedown', (e) => { if(e.target === back) close(); });
  document.body.append(back);
  const btn = (t: string, fn: () => any, secondary = true) => { const b = h('button', secondary ? BTN2 : BTN, t) as HTMLButtonElement; b.onclick = fn; return b; };
  const card = (...k: (Node | string)[]) => h('div', 'padding:12px;border-radius:14px;background:rgba(127,127,127,.12);margin:10px 0;', ...k);
  const go = (view?: 'chats' | 'history') => { close(); import('./ui').then((m) => m.openTozaBackup(undefined, view)); };

  const p = getProfile();
  const head = h('div', 'display:flex;align-items:center;gap:12px;');
  const avatar = h('div', 'width:56px;height:56px;border-radius:50%;background:var(--primary-color,#3390ec);color:#fff;display:flex;align-items:center;justify-content:center;font-size:28px;flex:none;', p.emoji || '🙂');
  const statusLine = h('div', 'opacity:.8;font-size:13px;', p.status || 'Status yozilmagan');
  head.append(avatar, h('div', 'flex:1;min-width:0', h('b', 'font-size:18px', 'Toza profilim'), statusLine), btn('Yopish', close));

  const stat = h('div', 'font-size:14px;', 'Yuklanmoqda…');
  const lockOn = !!localStorage.getItem('toza_lock');
  const refresh = async() => {
    const lines = [
      isEnabled() ? '✅ Zaxira yoqilgan' : '⚪ Zaxira o\'chiq',
      lockOn ? '🔒 PIN qulf yoqilgan' : '🔓 PIN qulf yoqilmagan',
      alertsOn() ? '🔔 O\'chirilgan/tahrirlangan haqida xabar: yoqilgan' : '🔕 Xabar berish o\'chiq',
      isPaid() ? '⭐ Obuna: rasm, video, ovoz saqlanadi' : '📝 Faqat matn saqlanadi'
    ];
    if(isEnabled()) {
      try {
        const c = await counts();
        lines.push(`💬 Saqlangan: ${c.total} xabar · o'chirilgan: ${c.deleted}`);
        const s = await serverStatus();
        if(s) lines.push(`💾 Serverda: ${fmtSize(s.used)} / ${fmtSize(s.quota)}`);
      } catch{ /* server javob bermasa ham profil ochiladi */ }
    }
    stat.replaceChildren(...lines.map((l) => h('div', 'margin:3px 0', l)));
  };

  const statusIn = h('input', 'width:100%;box-sizing:border-box;padding:10px;border-radius:10px;border:1px solid rgba(127,127,127,.4);background:transparent;color:inherit;font:inherit;') as HTMLInputElement;
  statusIn.placeholder = 'Shaxsiy status (masalan: Band, ishlayapman)'; statusIn.maxLength = 70; statusIn.value = p.status;
  let emoji = p.emoji, accent = p.accent;
  const chips = (items: string[], cur: () => string, pick: (v: string) => void, render: (v: string, el: HTMLElement) => void) => {
    const wrap = h('div', 'display:flex;gap:8px;flex-wrap:wrap;margin:8px 0;');
    const paint = () => [...wrap.children].forEach((c, i) => ((c as HTMLElement).style.outline = items[i] === cur() ? '2px solid var(--primary-color,#3390ec)' : 'none'));
    items.forEach((v) => { const c = h('button', 'width:38px;height:38px;border-radius:50%;border:0;cursor:pointer;font-size:20px;background:rgba(127,127,127,.2);color:inherit;outline-offset:2px;'); render(v, c); c.onclick = () => { pick(v); paint(); }; wrap.append(c); });
    paint();
    return wrap;
  };
  const emojiRow = chips(EMOJIS, () => emoji, (v) => { emoji = v; avatar.textContent = v || '🙂'; }, (v, el) => { el.textContent = v || '∅'; });
  const accentRow = chips(ACCENTS, () => accent, (v) => { accent = v; }, (v, el) => { el.style.background = v || 'var(--primary-color,#3390ec)'; el.textContent = v ? '' : '∅'; el.style.color = '#fff'; });
  const msg = h('div', 'margin-top:6px;font-size:13px;color:#2a9d4b;');
  const save = btn('Saqlash', () => { setProfile({status: statusIn.value.trim(), emoji, accent}); statusLine.textContent = statusIn.value.trim() || 'Status yozilmagan'; applyProfileTheme(); msg.textContent = 'Saqlandi.'; }, false);

  panel.append(
    head,
    card(h('b', '', 'Toza holati'), stat),
    card(h('b', '', 'Status va bezak'), statusIn, h('div', 'font-size:12px;opacity:.7;margin-top:8px', 'Belgi'), emojiRow, h('div', 'font-size:12px;opacity:.7', 'Rang mavzusi'), accentRow, save, msg,
      h('div', 'font-size:12px;opacity:.7;margin-top:6px', 'Faqat shu brauzerda saqlanadi, boshqalarga ko\'rinmaydi.')),
    card(h('b', '', 'Boshqaruv'), h('div', 'display:flex;gap:8px;flex-wrap:wrap;margin-top:8px', btn('Chatlar boshqaruvi', () => go('chats')), btn('Xavfsizlik tarixi', () => go('history')), btn('Zaxira va qulf', () => go())))
  );
  refresh();
}
