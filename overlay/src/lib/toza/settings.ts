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

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, any> = {}, ...kids: (Node | string)[]) => {
  const el = document.createElement(tag);
  const {style, ...rest} = props;
  Object.assign(el, rest);
  if(style) el.setAttribute('style', style);
  kids.forEach((k) => el.append(k));
  return el;
};
const INPUT = 'width:100%;box-sizing:border-box;padding:10px;border-radius:12px;border:1px solid rgba(127,127,127,.4);background:transparent;color:inherit;font:inherit;';
const fmtDate = (s: number) => new Date(s * 1000).toLocaleString();

/** Belgi katakchasi (tweb'ning uslubi oddiy checkbox'ni yashiradi). */
function check(label: string, sub: string, get: () => boolean, set: (v: boolean) => any) {
  const box = h('span', {style: 'flex:none;width:24px;height:24px;border-radius:7px;border:2px solid var(--ac,#4A5AE8);display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;line-height:1;'});
  const paint = () => { const on = get(); box.textContent = on ? '✓' : ''; box.style.background = on ? 'var(--ac,#4A5AE8)' : 'transparent'; };
  paint();
  const toggle = async() => { await set(!get()); paint(); };
  return h('div', {role: 'checkbox', tabIndex: 0, style: 'display:flex;gap:10px;align-items:flex-start;margin:8px 0;padding:10px;border-radius:12px;background:rgba(127,127,127,.12);cursor:pointer;user-select:none;',
    onclick: toggle, onkeydown: (e: KeyboardEvent) => { if(e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); } }},
  box, h('div', {}, h('div', {style: 'font-weight:600'}, label), h('div', {className: 'tz-sub'}, sub)));
}

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

  const flag = (k: keyof TozaFlags, label: string, subText: string) => check(label, subText, () => getFlags()[k], async(v) => { await setFlags({[k]: v}); updateReadButton(); });

  function main() {
    show(
      title('Toza sozlamalari'),
      sec('Ko\'rinmas rejim',
        flag('noRead', '«O\'qildi» belgisini yubormaslik', 'Xabarni o\'qisangiz ham suhbatdosh ikki belgini ko\'rmaydi. Ovozli xabar va dumaloq video «tinglandi» ham bo\'lmaydi. Chatda «👁 O\'qildi yuborish» tugmasi chiqadi.'),
        flag('noTyping', '«Yozmoqda...» ko\'rsatmaslik', 'Xabar yozayotganingizni suhbatdosh ko\'rmaydi.'),
        flag('noOnline', 'Doim «offlayn» ko\'rinish', 'Toza ochiq bo\'lsa ham «onlayn» holati yuborilmaydi. Telegram\'ning maxfiylik sozlamasi bilan birga ishlaydi.'),
        flag('noStoryView', 'Hikoyani yashirin ko\'rish', 'Hikoya egasi sizni ko\'rganlar ro\'yxatida ko\'rmaydi.'),
        note('Eslatma: telefondagi Telegram ochiq bo\'lsa, u o\'zi «onlayn» va «o\'qildi» yuboradi.')),
      sec('Bir martalik media',
        check('Bir martalik rasm va videoni saqlash', isPaid() ? 'Ko\'rilgach yo\'qoladigan rasm/video zaxiraga yoziladi. Toza zaxirasi yoqilgan bo\'lishi kerak.' : 'Sharpa obunasi va Toza zaxirasi bilan ishlaydi.', saveOnceOn, setSaveOnce),
        row(btn('Saqlanganlarni ko\'rish', () => viewOnce()))),
      sec('Hikoyalar', note('Kontaktlaringizning hozirgi hikoyalarini ko\'rib, rasm yoki video qilib saqlash.'), row(btn('Hikoyalarni ochish', () => viewStories()))),
      sec('Kalit so\'zlar', note(keywordsOn() ? `Yoqilgan: ${parseKeywords(keywordsRaw()).length} ta so'z.` : 'Guruh yoki chatda ismingiz yoki belgilangan so\'z chiqsa xabar beradi.'), row(btn('Sozlash', () => viewKeywords()))),
      sec('Lotin ↔ Kirill', note('Yozish maydonida: Alt+K — kirillga, Alt+L — lotinga. Matnni shu yerda ham o\'girish mumkin.'), row(btn('O\'girgich', () => viewTranslit()))),
      sec('Tarjima', note('Xabar ustida o\'ng tugma (telefonda bosib turish) → «Tarjima qilish». Telegram\'ning o\'z tarjimasi, o\'zbek tili ham bor. Tilni Sozlamalar → Til bo\'limida tanlaysiz.')),
      sec('Akkauntlar va papkalar', note('Bir nechta akkaunt: chap menyuda akkaunt nomi ustidan «Akkaunt qo\'shish» (3 tagacha). Papkalar va filtrlar: Sozlamalar → Chat papkalari (masalan, «O\'qilmagan», «Shaxsiy»).')),
      sec('Ko\'rinish', note('Rang mavzusi: «Toza profilim». Shrift o\'lchami, chat foni va tungi rejim: Sozlamalar → Umumiy sozlamalar.'))
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
      check('Kalit so\'z chiqsa xabar berish', 'Toza ochiq turganda ekranda (ruxsat bersangiz tizim bildirishnomasi bilan). Ochiq turgan chat uchun xabar berilmaydi.', keywordsOn, (v) => {
        setKeywordsOn(v);
        if(v && typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission().catch((): void => undefined);
      }),
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
