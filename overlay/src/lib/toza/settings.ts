// Toza sozlamalari oynasi (chap menyu → «Toza sozlamalari»): ko'rinmas rejim, bir martalik media, hikoyalarni saqlash,
// kalit so'zlar, lotin/kirill. Hammasi shu brauzerda saqlanadi.
import rootScope from '@lib/rootScope';
import appDownloadManager from '@lib/appDownloadManager';
import choosePhotoSize from '@lib/appManagers/utils/photos/choosePhotoSize';
import getPeerId from '@lib/appManagers/utils/peers/getPeerId';
import {ensureStyle} from './style';
import {bizState} from './biz';
import {isPlayApp, isStrict} from './play';
import {archive, watching, setWatching, peerTitle, updateReadButton} from './hooks';
import {getFlags, keywordsOn, keywordsRaw, saveOnceOn, setFlags, setKeywords, setKeywordsOn, setSaveOnce} from './prefs';
import type {TozaFlags} from './flags';
import {mediaNode} from './media-view';
import {cyrillicToLatin, latinToCyrillic, parseKeywords} from './tools-core';
import {convertComposer, sendScript, setSendScript, setShowScript, showScript} from './translit';
import type {Script} from './translit';
import {icon} from './icons';
import {FLAGS_EVENT} from './quickbar';
import {eyeCare, setEyeCare} from './eyecare';
import {eyeCareActive} from './tools-core';
import {playerPrefs, setPlayerPrefs} from './player';
import {featureOn, setFeature} from './features';
import {animPrefs, previewAnim, setAnimPrefs} from './anim';
import {profileDesignView} from './design';
import type {AnimPrefs, AnimSpeed, AnimStyle} from './anim';

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
/** Uch tanlovli tugmalar qatori: O'zgartirmaslik / Lotin / Kirill. */
function seg(get: () => Script, set: (v: Script) => void) {
  return choice<Script>([['off', 'O\'zgartirmaslik'], ['lat', 'Lotin'], ['cyr', 'Кирилл']], get, set);
}
/** Bir nechta tanlovli tugmalar qatori (bittasi tanlanadi). */
function choice<T extends string | number>(opts: [T, string][], get: () => T, set: (v: T) => void) {
  const wrap = h('div', {className: 'tz-seg', role: 'radiogroup'});
  const paint = () => wrap.querySelectorAll('button').forEach((b) => { const on = (b as HTMLElement).dataset.v === String(get()); b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
  for(const [v, label] of opts) wrap.append(h('button', {type: 'button', role: 'radio', onclick: () => { set(v); paint(); }}, label));
  wrap.querySelectorAll('button').forEach((b, i) => ((b as HTMLElement).dataset.v = String(opts[i][0])));
  paint();
  return wrap;
}
const eyeSummary = () => {
  const e = eyeCare();
  return e.mode === 'off' ? 'O\'chiq' : e.mode === 'on' ? 'Doim yoqilgan' : `Kechqurun ${String(e.from).padStart(2, '0')}:00 – ${String(e.to).padStart(2, '0')}:00`;
};
const animSummary = () => {
  const p = animPrefs();
  return p.on ? `${({soft: 'Yumshoq', pop: 'Sakrash', slide: 'Surilish'} as Record<AnimStyle, string>)[p.style]} · ${({slow: 'sekin', normal: 'o\'rtacha', fast: 'tez'} as Record<AnimSpeed, string>)[p.speed]}` : 'O\'chiq';
};
const scriptSummary = () => {
  const n: Record<Script, string> = {off: '', lat: 'lotinda', cyr: 'kirillda'};
  const a = showScript(), b = sendScript();
  return [a !== 'off' ? `Chat ${n[a]}` : '', b !== 'off' ? `Yuborish ${n[b]}` : ''].filter(Boolean).join(' · ') || 'Alt+K / Alt+L, avtomatik rejim o\'chiq';
};
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
  const show = (...nodes: Node[]) => { panel.replaceChildren(...nodes); panel.scrollTop = 0; };
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
      sec('Toza Premium', nav('spark', 'Toza Premium', bizState.paid ? 'Yoqilgan · Toza yopiq bo\'lsa ham ishlaydi' : 'Toza yopiq bo\'lsa ham ishlashi uchun · ' + (isPlayApp() ? 'Google Play obunasi' : 'Sharpa botida'), () => { close(); import('./ui').then((m) => m.openTozaBackup()); })),
      ...(isStrict() ? [] : [sec('Ko\'rinmas rejim', ...ghostRows, h('div', {className: 'tz-hint'}, 'Dastlabki uchtasi bosh ekranda ham bor. Telefondagi Telegram ochiq bo\'lsa, u o\'zi «onlayn» va «o\'qildi» yuboradi.'))]),
      sec('Saqlash',
        check('O\'chirilgan va tahrirlangan xabarlar', 'Bepul. Shaxsiy chatlarda boshqalar o\'chirgan xabar o\'z joyida qoladi, tahrirlanganining eski matni ostida ko\'rinadi.', watching, setWatching, 'trash'),
        nav('chat', 'O\'chirilgan xabarlar ro\'yxati', '', () => { close(); import('./ui').then((m) => m.openTozaBackup()); }),
        ...(isStrict() ? [] : [check('Bir martalik media', 'Ko\'rilgach yo\'qoladigan rasm/video shu qurilmada saqlanadi.', saveOnceOn, setSaveOnce, 'timer'),
          nav('gallery', 'Saqlangan bir martalik media', '', () => viewOnce())]),
        nav('download', 'Hikoyalarni yuklab olish', 'Rasm yoki video qilib saqlash', () => viewStories())),
      sec('Vositalar',
        nav('contacts', 'Kontaktlarni tozalash', 'Uzoq kirmagan, o\'chirilgan akkaunt, chat yo\'q…', () => { close(); import('./contacts').then((m) => m.openContactsCleaner(() => openTozaSettings())); }),
        nav('users', 'Kanal va guruhlarni tozalash', 'Uzoq ochilmagan, o\'qilmagan, jim qolgan…', () => { close(); import('./chats-clean').then((m) => m.openChatsCleaner(() => openTozaSettings())); })),
      sec('Ko\'rish',
        nav('eye', 'Ko\'z asrash', eyeSummary(), () => viewEyeCare()),
        nav('play', 'Video pleyer', 'Imo-ishoralar, yorqinlik, davom ettirish', () => viewPlayer()),
        nav('spark', 'Animatsiyalar', animSummary(), () => viewAnim()),
        nav('palette', 'Profil dizayni', 'Ism rangi va profil rangi', () => viewDesign())),
      sec('Qo\'shimchalarni yoqish/o\'chirish',
        check('Pastki panel (telefon)', 'Chatlar · Kontaktlar · Sozlamalar · Profil. «Profil»ni bosib tursangiz — akkauntlar.', () => featureOn('tabbar'), (v) => setFeature('tabbar', v), 'contact'),
        check('Video pleyer qo\'shimchalari', 'O\'chirsangiz Telegram\'ning oddiy pleyeri qoladi.', () => featureOn('player'), (v) => setFeature('player', v), 'play'),
        check('Toifa bo\'yicha belgilash', 'Bosib turib belgilaganda chiqadigan «O\'qilmagan», «Kanallar»… qatori.', () => featureOn('selbar'), (v) => setFeature('selbar', v), 'check'),
        check('Bosib turib yozish', 'Telefonda: mikrofonni bosib turing — yoziladi, qo\'yib yuboring — yuboriladi, chapga suring — bekor, tepaga — qulflash. Qisqa bosish: ovoz ↔ dumaloq video.', () => featureOn('holdrec'), (v) => setFeature('holdrec', v), 'mic'),
        check('Dumaloq videoda kamera almashtirish', 'Yozayotganda old/orqa kamera tugmasi.', () => featureOn('roundcam'), (v) => setFeature('roundcam', v), 'flip'),
        h('div', {className: 'tz-hint'}, (isStrict() ? '' : 'Ko\'rinmas rejim, ') + 'Ko\'z asrash va lotin/kirill yuqoridagi o\'z bo\'limlarida o\'chiriladi.')),
      sec('Qulayliklar',
        nav('bell', 'Kalit so\'zlar', kwOn ? `Yoqilgan · ${kwN} ta so'z` : 'O\'chiq', () => viewKeywords()),
        nav('abc', 'Lotin ↔ Kirill', scriptSummary(), () => viewTranslit())),
      sec('Telegram\'ning o\'zida',
        info('translate', 'Tarjima', 'Xabarni bosib turing → «Tarjima qilish»'),
        info('users', 'Akkauntlar va papkalar', 'Menyu → akkaunt qo\'shish (3 tagacha); Sozlamalar → Chat papkalari'),
        info('palette', 'Ko\'rinish', 'Rang: «Toza profilim». Shrift, fon, tungi rejim: Sozlamalar → Umumiy'))
    );
  }

  async function viewOnce() {
    const list = h('div', {}, 'Yuklanmoqda…');
    sub('Bir martalik media', list);
    if(!watching()) { list.replaceChildren(note('Avval «O\'chirilgan va tahrirlangan» → «Chatda ko\'rsatish»ni yoqing.')); return; }
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

  function viewEyeCare() {
    const c = eyeCare();
    const hours = Array.from({length: 24}, (_, i) => i);
    const sel = (get: () => number, set: (v: number) => void) => {
      const x = h('select', {className: 'tz-sel', onchange: () => set(+x.value)}) as HTMLSelectElement;
      hours.forEach((n) => x.append(h('option', {value: String(n)}, `${String(n).padStart(2, '0')}:00`)));
      x.value = String(get());
      return x;
    };
    const st = h('div', {className: 'tz-hint'});
    const paint = () => { const e = eyeCare(); st.textContent = eyeCareActive(e, new Date().getHours()) ? 'Hozir yoqilgan.' : e.mode === 'night' ? `Hozir o'chiq, ${String(e.from).padStart(2, '0')}:00 da yoqiladi.` : 'Hozir o\'chiq.'; };
    const upd = (p: Parameters<typeof setEyeCare>[0]) => { setEyeCare(p); paint(); };
    paint();
    sub('Ko\'z asrash',
      note('Ekranga iliq rang beradi va ko\'k nurni kamaytiradi. Kechqurun ko\'z kamroq charchaydi va uyqu buzilmaydi. Faqat shu qurilmada ishlaydi.'),
      h('div', {className: 'tz-sec'}, h('b', {}, 'Rejim'),
        choice<string>([['off', 'O\'chiq'], ['on', 'Doim'], ['night', 'Kechqurun']], () => eyeCare().mode, (v) => upd({mode: v as any})),
        h('div', {className: 'tz-row'}, h('span', {className: 'tz-ic'}, icon('moon')), h('div', {className: 'tz-tx'}, 'Kechqurun rejimi vaqti',
          h('div', {className: 'tz-sub', style: 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:6px'}, sel(() => c.from, (v) => upd({from: v})), 'dan', sel(() => c.to, (v) => upd({to: v})), 'gacha'))), st),
      h('div', {className: 'tz-sec'}, h('b', {}, 'Iliqlik'),
        choice<number>([[1, 'Yengil'], [2, 'O\'rta'], [3, 'Kuchli']], () => eyeCare().warm, (v) => upd({warm: v as any}))),
      h('div', {className: 'tz-sec'}, h('b', {}, 'Xiralashtirish'),
        choice<number>([[0, 'Yo\'q'], [1, 'Oz'], [2, 'O\'rta'], [3, 'Ko\'p']], () => eyeCare().dim, (v) => upd({dim: v as any})),
        h('div', {className: 'tz-hint'}, 'Telefon yorqinligi eng pastda bo\'lsa ham ekran ko\'zni qamashtirsa foydali.')));
  }

  async function viewDesign() {
    const box = h('div', {}, 'Yuklanmoqda…');
    sub('Profil dizayni', box);
    try { box.replaceChildren(await profileDesignView(note)); } catch(e: any) { box.replaceChildren(note('Ochib bo\'lmadi: ' + (e?.type || e?.message || e), '#d33')); }
  }

  function viewAnim() {
    const demo = h('div', {className: 'tz-an-demo'});
    const play = () => {
      demo.replaceChildren();
      ['Salom!', 'Animatsiya shunday ko\'rinadi'].forEach((t, i) => {
        const b = h('div', {className: 'bubble'}, h('div', {className: 'bubble-content-wrapper'}, t));
        demo.append(b);
        setTimeout(() => previewAnim(b), 60 + i * 140);
      });
    };
    const set = (p: Partial<AnimPrefs>) => { setAnimPrefs(p); play(); };
    const part = (k: 'msg' | 'btn' | 'list' | 'pop', ic: string, label: string, s: string) => check(label, s, () => animPrefs()[k], (v) => set({[k]: v}), ic);
    sub('Animatsiyalar',
      check('Animatsiyalar', 'Yengil jonlantirish. Telegram\'da «Animatsiyalar» o\'chiq bo\'lsa yoki telefonda «harakatni kamaytirish» yoqilgan bo\'lsa ishlamaydi.', () => animPrefs().on, (v) => set({on: v}), 'spark'),
      h('div', {className: 'tz-sec'}, h('b', {}, 'Uslub'),
        choice<AnimStyle>([['soft', 'Yumshoq'], ['pop', 'Sakrash'], ['slide', 'Surilish']], () => animPrefs().style, (v) => set({style: v})),
        h('b', {}, 'Tezlik'),
        choice<AnimSpeed>([['slow', 'Sekin'], ['normal', 'O\'rtacha'], ['fast', 'Tez']], () => animPrefs().speed, (v) => set({speed: v})),
        demo,
        row(btn('Yana ko\'rsatish', () => play()))),
      h('div', {className: 'tz-sec'}, h('b', {}, 'Qayerda'),
        part('msg', 'chat', 'Yangi xabar', 'Kelgan xabar chatda jonlanib chiqadi.'),
        part('btn', 'tune', 'Tugmalar', 'Bosganda tugma biroz kichrayadi, kalitlar sakrab o\'tadi.'),
        part('list', 'users', 'Chatlar ro\'yxati', 'Chatni bosganda yengil bosilish effekti.'),
        part('pop', 'spark', 'Toza oynalari', 'Sozlamalar, yangilanish xabari va belgilash qatori chiqishi.'))
    );
    play();
  }

  function viewPlayer() {
    const p = (k: 'gestures' | 'resume' | 'wheel', ic: string, label: string, s: string) => check(label, s, () => playerPrefs()[k], (v) => setPlayerPrefs({[k]: v}), ic);
    sub('Video pleyer',
      note('Telegram\'dagi videoni ochganingizda ishlaydi. Pastki paneldagi ⚙ tugmasi: yorqinlik, takrorlash, ekranga to\'ldirish, kadrni rasm qilib saqlash.'),
      h('div', {className: 'tz-sec'}, h('b', {}, 'Boshqaruv'),
        p('gestures', 'expand', 'Imo-ishoralar', 'Ikki marta tegish: ortga/oldinga. To\'liq ekranda surish: chapda yorqinlik, o\'ngda ovoz, yonga vaqt.'),
        p('wheel', 'volume', 'G\'ildirak bilan ovoz', 'Sichqoncha g\'ildiragi ovozni, Shift bilan yorqinlikni o\'zgartiradi.'),
        p('resume', 'play', 'To\'xtagan joyidan davom ettirish', '1,5 daqiqadan uzun videolar uchun.')),
      h('div', {className: 'tz-sec'}, h('b', {}, 'Ikki marta tegib siljitish'),
        choice<number>([[5, '5 soniya'], [10, '10 soniya'], [15, '15 soniya']], () => playerPrefs().seek, (v) => setPlayerPrefs({seek: v as any}))),
      h('div', {className: 'tz-sec'}, h('b', {}, 'Klaviatura'),
        info('abc', 'J / L', 'Ortga / oldinga'), info('volume', '↑ / ↓', 'Ovoz'), info('sun', 'B / Shift+B', 'Yorqinlik'),
        h('div', {className: 'tz-hint'}, 'Telegram\'ning o\'zida: Probel to\'xtatish, F to\'liq ekran, M ovozsiz, Alt + / − tezlik, bosib turish 2× tezlik.')));
  }

  function viewTranslit() {
    const ta = h('textarea', {rows: 6, placeholder: 'Matnni shu yerga yozing yoki qo\'ying', style: INPUT + 'resize:vertical;'}) as HTMLTextAreaElement;
    const msg = h('div');
    const conv = (fn: (s: string) => string) => { ta.value = fn(ta.value); };
    sub('Lotin ↔ Kirill',
      h('div', {className: 'tz-sec'}, h('b', {}, 'Chatdagi xabarlar'),
        seg(showScript, setShowScript), h('div', {className: 'tz-hint'}, 'O\'zbekcha xabarlar tanlangan yozuvda ko\'rinadi. Ruscha va inglizcha xabarlar o\'zgarmaydi. Asl matn saqlanadi.')),
      h('div', {className: 'tz-sec'}, h('b', {}, 'Men yuboradigan xabarlar'),
        seg(sendScript, setSendScript), h('div', {className: 'tz-hint'}, 'Yuborish bosilganda o\'zbekcha matn o\'zi o\'giriladi. Havola, emoji yoki formatlash bo\'lsa tegilmaydi. Qo\'lda: Alt+K kirillga, Alt+L lotinga.')),
      h('b', {}, 'O\'girgich'), ta,
      row(btn('Kirillga', () => conv(latinToCyrillic), true), btn('Lotinga', () => conv(cyrillicToLatin)),
        btn('Nusxalash', async(b) => { await navigator.clipboard?.writeText(ta.value); b.textContent = 'Nusxalandi'; setTimeout(() => (b.textContent = 'Nusxalash'), 1500); })),
      row(btn('Yozish maydonidagi matnni o\'girish', () => { msg.replaceChildren(note(convertComposer() ? 'O\'girildi.' : 'Avval chatni oching va matn yozing.', '')); })), msg);
  }

  main();
}
