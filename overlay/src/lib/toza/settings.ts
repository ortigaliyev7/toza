// Toza sozlamalari oynasi (chap menyu → «Toza sozlamalari»): ko'rinmas rejim, bir martalik media, hikoyalarni saqlash,
// kalit so'zlar, lotin/kirill. Hammasi shu brauzerda saqlanadi.
import rootScope from '@lib/rootScope';
import appDownloadManager from '@lib/appDownloadManager';
import choosePhotoSize from '@lib/appManagers/utils/photos/choosePhotoSize';
import getPeerId from '@lib/appManagers/utils/peers/getPeerId';
import {ensureStyle} from './style';
import {archive, isEnabled, isPaid, peerTitle, updateReadButton} from './hooks';
import {getFlags, keywordsOn, keywordsRaw, saveOnceOn, setFlags, setKeywords, setKeywordsOn, setSaveOnce} from './prefs';
import type {TozaFlags} from './flags';
import {mediaNode} from './media-view';
import {cyrillicToLatin, latinToCyrillic, parseKeywords} from './tools-core';
import {convertComposer} from './translit';
import {icon} from './icons';
import {FLAGS_EVENT} from './quickbar';

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, any> = {}, ...kids: (Node | string)[]) => {
  const el = document.createElement(tag);
  const {style, ...rest} = props;
  Object.assign(el, rest);
  if(style) el.setAttribute('style', style);
  kids.forEach((k) => el.append(k));
  return el;
};
const INPUT = '';
const fmtDate = (s: number) => new Date(s * 1000).toLocaleString();

/** Sozlama qatori: rangli ikonka, nom, izoh va o'ng tomonda almashtirgich (Toza dizayni). */
function check(label: string, sub: string, get: () => boolean, set: (v: boolean) => any, ic = 'read') {
  const sw = h('span', {className: 'tz-sw'});
  const paint = () => { const on = get(); sw.classList.toggle('on', on); row.setAttribute('aria-checked', String(on)); };
  const toggle = async() => { await set(!get()); paint(); };
  const row = h('div', {className: 'tz-row tz-click', role: 'switch', tabIndex: 0,
    onclick: toggle, onkeydown: (e: KeyboardEvent) => { if(e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); } }},
  h('span', {className: 'tz-ic'}, icon(ic)), h('div', {className: 'tz-tx'}, label, ...(sub ? [h('div', {className: 'tz-sub'}, sub)] : [])), sw);
  paint();
  (row as any).tzPaint = paint;
  return row;
}
/** Boshqa oynaga o'tadigan qator (o'ngda ›). */
function nav(ic: string, label: string, sub: string, fn: () => any, soft = false) {
  return h('div', {className: 'tz-row tz-click', role: 'button', tabIndex: 0, onclick: fn, onkeydown: (e: KeyboardEvent) => { if(e.key === 'Enter') fn(); }},
    h('span', {className: 'tz-ic' + (soft ? ' tz-soft' : '')}, icon(ic)), h('div', {className: 'tz-tx'}, label, ...(sub ? [h('div', {className: 'tz-sub'}, sub)] : [])), h('span', {className: 'tz-chev'}, icon('chevron', 18)));
}
/** Faqat ma'lumot qatori. */
const info = (ic: string, label: string, sub: string) => h('div', {className: 'tz-row'}, h('span', {className: 'tz-ic tz-soft'}, icon(ic)), h('div', {className: 'tz-tx'}, label, h('div', {className: 'tz-sub'}, sub)));

// ---------------------------------------------------------------- hikoyalar
async function downloadStory(peerId: number, story: any, name: string) {
  const media = story?.media;
  let blob: Blob | undefined, ext = 'jpg';
  if(media?._ === 'messageMediaPhoto' && media.photo) {
    blob = await (appDownloadManager as any).downloadMedia({media: media.photo, thumb: choosePhotoSize(media.photo, 2560, 2560)});
  } else if(media?._ === 'messageMediaDocument' && media.document) {
    blob = await (appDownloadManager as any).downloadMedia({media: media.document});
    ext = 'mp4';
  }
  if(!blob) throw new Error('no_media');
  const a = h('a', {href: URL.createObjectURL(blob), download: `toza-hikoya-${name}-${story.id}.${ext}`});
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 20000);
}

export function openTozaSettings() {
  ensureStyle();
  const back = h('div', {className: 'tz-back'});
  const panel = h('div', {className: 'tz-pop'});
  back.append(panel);
  const close = () => back.remove();
  back.addEventListener('mousedown', (e) => { if(e.target === back) close(); });
  document.body.append(back);

  const title = (t: string) => h('div', {className: 'tz-head', style: 'display:flex;align-items:center;justify-content:space-between;'}, h('b', {}, t), h('button', {className: 'tz-x', onclick: close}, '✕'));
  const note = (t: string, color = '') => h('div', {style: 'margin:8px 0;opacity:.85;' + (color ? `color:${color};opacity:1;` : '')}, t);
  const row = (...k: (Node | string)[]) => h('div', {style: 'display:flex;gap:8px;flex-wrap:wrap;margin:10px 0;'}, ...k);
  const btn = (t: string, fn: (b: HTMLButtonElement) => any, main = false) => {
    const b = h('button', {className: main ? 'tz-main' : ''}, t) as HTMLButtonElement;
    b.onclick = async() => { b.disabled = true; try { await fn(b); } finally { b.disabled = false; } };
    return b;
  };
  const sec = (head: string, ...k: Node[]) => h('div', {className: 'tz-sec'}, h('b', {}, head), ...k);
  const show = (...nodes: Node[]) => panel.replaceChildren(...nodes);
  const sub = (t: string, ...k: Node[]) => show(title(t), ...k, row(btn('Orqaga', () => main())));

  const flag = (k: keyof TozaFlags, ic: string, label: string, subText: string) => check(label, subText, () => getFlags()[k], async(v) => { await setFlags({[k]: v}); updateReadButton(); window.dispatchEvent(new Event(FLAGS_EVENT)); }, ic);

  function main() {
    const ghostRows = [
      flag('noRead', 'read', 'Yashirin o\'qish', '«O\'qildi» va «tinglandi» yuborilmaydi.'),
      flag('noStoryView', 'story', 'Yashirin hikoya', 'Hikoyani bildirmay ko\'rasiz.'),
      flag('noOnline', 'ghost', 'Offlayn ko\'rinish', 'Toza ochiq bo\'lsa ham «onlayn» bo\'lmaysiz.'),
      flag('noTyping', 'typing', '«Yozmoqda...» yashirish', 'Yozayotganingiz ko\'rinmaydi.')
    ];
    const repaint = () => ghostRows.forEach((r: any) => r.tzPaint?.());
    window.addEventListener(FLAGS_EVENT, repaint);
    const closeObs = new MutationObserver(() => { if(!back.isConnected) { window.removeEventListener(FLAGS_EVENT, repaint); closeObs.disconnect(); } });
    closeObs.observe(document.body, {childList: true});
    const kwOn = keywordsOn(), kwN = parseKeywords(keywordsRaw()).length;
    show(
      title('Toza sozlamalari'),
      sec('Ko\'rinmas rejim', ...ghostRows, h('div', {className: 'tz-hint'}, 'Dastlabki uchtasi bosh ekranda ham bor. Telefondagi Telegram ochiq bo\'lsa, u o\'zi «onlayn» va «o\'qildi» yuboradi.')),
      sec('Saqlash',
        check('Bir martalik media', isPaid() ? 'Ko\'rilgach yo\'qoladigan rasm/video zaxiraga yoziladi.' : 'Sharpa obunasi va Toza zaxirasi bilan ishlaydi.', saveOnceOn, setSaveOnce, 'timer'),
        nav('gallery', 'Saqlangan bir martalik media', '', () => viewOnce()),
        nav('download', 'Hikoyalarni yuklab olish', 'Rasm yoki video qilib saqlash', () => viewStories())),
      sec('Qulayliklar',
        nav('bell', 'Kalit so\'zlar', kwOn ? `Yoqilgan · ${kwN} ta so'z` : 'O\'chiq', () => viewKeywords()),
        nav('abc', 'Lotin ↔ Kirill', 'Yozayotganda Alt+K / Alt+L', () => viewTranslit())),
      sec('Telegram\'ning o\'zida',
        info('translate', 'Tarjima', 'Xabarni bosib turing → «Tarjima qilish»'),
        info('users', 'Akkauntlar va papkalar', 'Menyu → akkaunt qo\'shish (3 tagacha); Sozlamalar → Chat papkalari'),
        info('palette', 'Ko\'rinish', 'Rang: «Toza profilim». Shrift, fon, tungi rejim: Sozlamalar → Umumiy'))
    );
  }

  async function viewOnce() {
    const list = h('div', {}, 'Yuklanmoqda…');
    sub('Bir martalik media', list);
    if(!isEnabled()) { list.replaceChildren(note('Avval Toza zaxirasini yoqing.')); return; }
    const items = await archive.onceMessages();
    list.replaceChildren();
    if(!items.length) { list.append(note('Hozircha yo\'q.')); return; }
    for(const m of items.slice(0, 100)) {
      const file = await archive.mediaOf(m.peerId, m.mid);
      list.append(h('div', {style: 'padding:8px 0;border-bottom:1px solid rgba(127,127,127,.2);'},
        h('div', {className: 'tz-sub'}, `${await peerTitle(m.peerId)} · ${fmtDate(m.date)}`),
        file ? mediaNode(file) : h('div', {className: 'tz-sub'}, 'Fayl saqlanmagan (obuna yo\'q yoki yuklab bo\'lmadi).')));
    }
  }

  async function viewStories() {
    const list = h('div', {}, 'Yuklanmoqda…');
    const msg = h('div');
    sub('Hikoyalar', msg, list);
    const mgr = (rootScope as any).managers;
    try {
      const all = await mgr.appStoriesManager.getAllStories();
      const peers = (all?.peer_stories || []).map((ps: any) => getPeerId(ps.peer)).filter((p: number) => p && p !== Number(rootScope.myId));
      list.replaceChildren();
      if(!peers.length) { list.append(note('Hozir hikoyalar yo\'q.')); return; }
      for(const peerId of peers.slice(0, 60)) {
        const name = await peerTitle(String(peerId));
        list.append(row(btn(name, () => viewPeerStories(peerId, name))));
      }
    } catch(e: any) { list.replaceChildren(note('Hikoyalarni olib bo\'lmadi: ' + (e?.type || e?.message || e), '#d33')); }
  }

  async function viewPeerStories(peerId: number, name: string) {
    const list = h('div', {}, 'Yuklanmoqda…');
    const msg = h('div');
    show(title(name), msg, list, row(btn('Orqaga', () => viewStories())));
    const mgr = (rootScope as any).managers;
    try {
      const ps = await mgr.appStoriesManager.getPeerStories(peerId);
      const ids = (ps?.stories || []).map((s: any) => s.id);
      const stories = ids.length ? await mgr.appStoriesManager.getStoriesById(peerId, ids) : [];
      list.replaceChildren();
      if(!stories.length) { list.append(note('Hikoya yo\'q.')); return; }
      const safe = name.replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 30) || 'hikoya';
      for(const s of stories) {
        if(s?._ !== 'storyItem') continue;
        const kind = s.media?._ === 'messageMediaPhoto' ? 'Rasm' : 'Video';
        list.append(row(h('div', {style: 'flex:1;min-width:140px;'}, `${kind} · ${fmtDate(s.date)}`, s.caption ? h('div', {className: 'tz-sub'}, s.caption.slice(0, 120)) : ''),
          btn('Saqlash', async(b) => { msg.replaceChildren(); try { await downloadStory(peerId, s, safe); b.textContent = '✓'; } catch{ msg.append(note('Yuklab bo\'lmadi.', '#d33')); } }, true)));
      }
    } catch(e: any) { list.replaceChildren(note('Olib bo\'lmadi: ' + (e?.type || e?.message || e), '#d33')); }
  }

  function viewKeywords() {
    const ta = h('textarea', {rows: 5, placeholder: 'Masalan: Avazbek, ish, uchrashuv', style: INPUT + 'resize:vertical;'}) as HTMLTextAreaElement;
    ta.value = keywordsRaw();
    const msg = h('div');
    sub('Kalit so\'zlar',
      h('div', {className: 'tz-sec', style: 'padding-top:4px'}, check('Kalit so\'z chiqsa xabar berish', 'Toza ochiq turganda. Ochiq turgan chat uchun xabar berilmaydi.', keywordsOn, (v) => {
        setKeywordsOn(v);
        if(v && typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission().catch((): void => undefined);
      }, 'bell')),
      note('So\'zlarni vergul yoki yangi qator bilan ajrating (50 tagacha). Katta-kichik harf farqi yo\'q, so\'z boshidan qidiriladi: «ish» — «ishlar»ni topadi, «kishi»ni emas.'),
      ta, row(btn('Saqlash', () => { setKeywords(ta.value); msg.replaceChildren(note(`Saqlandi: ${parseKeywords(ta.value).length} ta so'z.`, '#2a9d4b')); }, true)), msg);
  }

  function viewTranslit() {
    const ta = h('textarea', {rows: 6, placeholder: 'Matnni shu yerga yozing yoki qo\'ying', style: INPUT + 'resize:vertical;'}) as HTMLTextAreaElement;
    const msg = h('div');
    const conv = (fn: (s: string) => string) => { ta.value = fn(ta.value); };
    sub('Lotin ↔ Kirill', ta,
      row(btn('Kirillga', () => conv(latinToCyrillic), true), btn('Lotinga', () => conv(cyrillicToLatin)),
        btn('Nusxalash', async(b) => { await navigator.clipboard?.writeText(ta.value); b.textContent = 'Nusxalandi'; setTimeout(() => (b.textContent = 'Nusxalash'), 1500); })),
      row(btn('Yozish maydonidagi matnni o\'girish', () => { msg.replaceChildren(note(convertComposer() ? 'O\'girildi.' : 'Avval chatni oching va matn yozing.', '')); })), msg);
  }

  main();
}
