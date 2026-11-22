import {alertsOn, setAlertsOn} from './alerts';
import {archive, chatEnabled, chatUsage, counts, isPaid, setChatEnabled, disableBackup, enableBackup, flushNow, generateRecoveryCode, isEnabled, linkSharpa, normalizeCode, peerTitle, restoreBackup, savedCode, serverStatus, serverUrl, startTozaBackup, state, TozaApiError} from './hooks';

const ERR: Record<string, string> = {
  bad_code: 'Kod noto\'g\'ri yozilgan. 26 belgi bo\'lishi kerak (harf va 2–7 raqamlari).',
  no_server: 'Zaxira serveri sozlanmagan (VITE_TB_URL).',
  none: 'Bunday zaxira topilmadi. Kodni tekshiring.',
  denied: 'Kirish rad etildi.',
  quota: 'Zaxira hajmi to\'ldi. Sharpa obunasini ulang yoki eski zaxirani tozalang.',
  bad_link: 'Bog\'lash kodi noto\'g\'ri yoki muddati tugagan. Botda /zaxira yozing.',
  rate: 'Juda ko\'p so\'rov. Birozdan keyin urinib ko\'ring.',
  unavailable: 'Saqlash vaqtincha ishlamayapti. Keyinroq urinib ko\'ring.'
};
const errText = (e: any) => ERR[e instanceof TozaApiError ? (e.code === 'bad_code' && e.status === 400 ? 'bad_link' : e.code) : e?.message] || ('Xato: ' + (e?.message || e));
const fmtSize = (n: number) => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.ceil(n / 1024) + ' KB';
const fmtDate = (s: number) => new Date(s * 1000).toLocaleString();

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & {style?: string} = {}, ...kids: (Node | string)[]) => {
  const el = document.createElement(tag);
  const {style, ...rest} = props as any;
  Object.assign(el, rest);
  if(style) el.setAttribute('style', style);
  kids.forEach((k) => el.append(k));
  return el;
};
const BTN = 'border:0;border-radius:10px;padding:10px 14px;font:inherit;font-weight:600;cursor:pointer;background:var(--primary-color,#3390ec);color:#fff;';
const BTN2 = 'border:0;border-radius:10px;padding:10px 14px;font:inherit;font-weight:600;cursor:pointer;background:rgba(127,127,127,.18);color:inherit;';

export function openTozaBackup() {
  startTozaBackup();
  const back = h('div', {style: 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:12px;'});
  const panel = h('div', {style: 'background:var(--surface-color,#fff);color:var(--primary-text-color,#000);border-radius:16px;max-width:460px;width:100%;max-height:92vh;overflow:auto;padding:18px;box-shadow:0 10px 40px rgba(0,0,0,.35);font-size:15px;line-height:1.4;'});
  back.append(panel);
  const close = () => back.remove();
  back.addEventListener('mousedown', (e) => { if(e.target === back) close(); });
  document.body.append(back);

  const title = (t: string) => h('div', {style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;'}, h('b', {style: 'font-size:18px'}, t), Object.assign(h('button', {style: BTN2 + 'padding:4px 10px'}, 'Yopish'), {onclick: close}));
  const note = (t: string, color = '') => h('div', {style: 'margin:8px 0;opacity:.85;' + (color ? `color:${color};opacity:1;` : '')}, t);
  const row = (...k: (Node | string)[]) => h('div', {style: 'display:flex;gap:8px;flex-wrap:wrap;margin:10px 0;'}, ...k);
  const btn = (t: string, fn: (b: HTMLButtonElement) => any, secondary = false) => {
    const b = h('button', {style: secondary ? BTN2 : BTN}, t);
    b.onclick = async() => { b.disabled = true; try { await fn(b); } finally { b.disabled = false; } };
    return b;
  };
  const show = (...nodes: Node[]) => { panel.replaceChildren(...nodes); };

  async function viewOff() {
    const msg = h('div');
    const codeIn = h('input', {placeholder: 'XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XX', style: 'width:100%;box-sizing:border-box;padding:10px;border-radius:10px;border:1px solid rgba(127,127,127,.4);background:transparent;color:inherit;font:inherit;letter-spacing:1px;'}) as HTMLInputElement;
    show(
      title('Toza zaxirasi'),
      note('O\'chirilgan va tahrirlangan xabarlarni saqlaydi. Xabarlar brauzeringizda shifrlanadi, server ularni o\'qiy olmaydi. Telegram akkauntingiz o\'chsa ham zaxira saqlanadi.'),
      row(btn('Yangi zaxira yaratish', () => viewNew())),
      h('hr', {style: 'border:0;border-top:1px solid rgba(127,127,127,.3);margin:14px 0'}),
      h('b', {}, 'Mavjud zaxirani tiklash'),
      note('Yangi qurilmada: avval yaratilgan tiklash kodini kiriting.'),
      codeIn,
      row(btn('Tiklash', async() => {
        msg.replaceChildren();
        try {
          const r = await restoreBackup(codeIn.value);
          msg.append(note(`Tiklandi: ${r.messages} ta yozuv (o'chirilgan: ${r.deleted}).`, '#2a9d4b'));
          setTimeout(viewOn, 900);
        } catch(e) { msg.append(note(errText(e), '#d33')); }
      })),
      msg
    );
  }

  function viewNew() {
    const code = generateRecoveryCode();
    const msg = h('div');
    // tweb'ning umumiy uslubi oddiy checkbox'ni ko'rinmas qiladi: o'z belgi katakchamizni chizamiz
    let acked = false;
    const boxEl = h('span', {style: 'flex:none;width:24px;height:24px;border-radius:7px;border:2px solid var(--primary-color,#3390ec);display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;line-height:1;'});
    const setAck = (v: boolean) => { acked = v; msg.replaceChildren(); boxEl.textContent = v ? '✓' : ''; boxEl.style.background = v ? 'var(--primary-color,#3390ec)' : 'transparent'; };
    const go = btn('Davom etish', async() => {
      msg.replaceChildren();
      if(!acked) { msg.append(note('Avval kodni yozib olganingizni tasdiqlang.', '#d33')); return; }
      try { await enableBackup(code); viewOn(); } catch(e) { msg.append(note(errText(e), '#d33')); }
    });
    show(
      title('Tiklash kodingiz'),
      note('Bu kodni xavfsiz joyga yozib qo\'ying. Uni yo\'qotsangiz, zaxirani hech kim (biz ham) tiklay olmaydi.'),
      h('div', {style: 'font:700 17px/1.5 ui-monospace,monospace;letter-spacing:1px;text-align:center;padding:14px;border-radius:12px;background:rgba(127,127,127,.15);user-select:all;word-break:break-all;'}, code),
      row(
        btn('Nusxalash', async(b) => { await navigator.clipboard?.writeText(code); b.textContent = 'Nusxalandi'; setTimeout(() => (b.textContent = 'Nusxalash'), 1500); }, true),
        btn('Faylga saqlash', () => { const a = h('a', {href: URL.createObjectURL(new Blob([`Toza tiklash kodi: ${code}\n`], {type: 'text/plain'})), download: 'toza-tiklash-kodi.txt'}); a.click(); }, true)
      ),
      Object.assign(h('div', {style: 'display:flex;gap:10px;align-items:flex-start;margin:12px 0;cursor:pointer;padding:10px;border-radius:12px;background:rgba(127,127,127,.12);user-select:none;'}, boxEl, 'Kodni yozib oldim. Yo\'qotsam, zaxirani tiklab bo\'lmasligini tushundim.'), {role: 'checkbox', tabIndex: 0, onclick: () => setAck(!acked), onkeydown: (e: KeyboardEvent) => { if(e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setAck(!acked); } }}),
      row(go, btn('Orqaga', () => viewOff(), true)),
      msg
    );
  }

  function alertRow() {
    let on = alertsOn();
    const box = h('span', {style: 'flex:none;width:24px;height:24px;border-radius:7px;border:2px solid var(--primary-color,#3390ec);display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;line-height:1;'});
    const paint = () => { box.textContent = on ? '✓' : ''; box.style.background = on ? 'var(--primary-color,#3390ec)' : 'transparent'; };
    paint();
    const label = h('div', {}, h('div', {style: 'font-weight:600'}, 'Tahrirlangan va o\'chirilgan xabarlar haqida xabar berish'),
      h('div', {style: 'font-size:12px;opacity:.7'}, isPaid() ? 'Toza ochiq turganda ekranda (va ruxsat bersangiz tizim bildirishnomasi bilan) darrov ko\'rsatiladi. Toza yopiq bo\'lsa ishlamaydi.' : 'Sharpa obunasi bilan ishlaydi. Obuna ulangach o\'zi yoqiladi.'));
    return Object.assign(h('div', {style: 'display:flex;gap:10px;align-items:flex-start;margin:10px 0;padding:10px;border-radius:12px;background:rgba(127,127,127,.12);cursor:pointer;user-select:none;'}, box, label), {role: 'checkbox', tabIndex: 0,
      onclick: () => { on = !on; setAlertsOn(on); paint(); if(on && typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission().catch(() => undefined); }});
  }

  async function viewOn() {
    if(!isEnabled()) return viewOff();
    const info = h('div', {}, 'Yuklanmoqda…');
    const list = h('div');
    const msg = h('div');
    const linkIn = h('input', {placeholder: 'Botdagi /zaxira kodi', style: 'padding:10px;border-radius:10px;border:1px solid rgba(127,127,127,.4);background:transparent;color:inherit;font:inherit;flex:1;min-width:140px;'}) as HTMLInputElement;
    const refresh = async() => {
      const c = await counts();
      let srv = '';
      try { const s = await serverStatus(); if(s) srv = ` · Serverda: ${fmtSize(s.used)} / ${fmtSize(s.quota)}${s.linked ? ' (obuna ulangan)' : ''}`; } catch(e) { srv = ' · Server: ' + errText(e); }
      info.textContent = `Saqlangan: ${c.total} ta xabar · Ovoz: ${c.voices} · Rasm/video: ${c.files} · O'chirilgan: ${c.deleted} · Yuklanmagan: ${c.pending}${srv}` + (state.lastError ? ` · Oxirgi xato: ${state.lastError}` : '');
    };
    show(
      title('Toza zaxirasi: yoqilgan'),
      info,
      row(
        btn('Hozir saqlash', async() => { msg.replaceChildren(); try { const n = await flushNow(); msg.append(note(n ? `Yuklandi (${n} bo'lak).` : 'Yangi narsa yo\'q.', '#2a9d4b')); } catch(e) { msg.append(note(errText(e), '#d33')); } await refresh(); }),
        btn('Chatlar', async() => { await showChats(list); }, true),
        btn('O\'chirilgan xabarlar', async() => { await showDeleted(list); }, true),
        btn('Kodni ko\'rsatish', () => { msg.replaceChildren(note('Tiklash kodi: ' + savedCode().replace(/(.{4})/g, '$1-').replace(/-$/, ''))); }, true)
      ),
      alertRow(),
      h('b', {}, 'Sharpa obunasi bilan bog\'lash'),
      note('Matn bepul saqlanadi. Ovozli xabar, rasm va dumaloq video faqat Sharpa obunasi bilan saqlanadi: Sharpa botida /zaxira yozing va kodni kiriting.' + (isPaid() ? ' Obuna ulangan.' : '')),
      row(linkIn, btn('Bog\'lash', async() => { msg.replaceChildren(); try { await linkSharpa(linkIn.value); msg.append(note('Bog\'landi.', '#2a9d4b')); } catch(e) { msg.append(note(errText(e), '#d33')); } await refresh(); })),
      msg,
      list,
      h('hr', {style: 'border:0;border-top:1px solid rgba(127,127,127,.3);margin:14px 0'}),
      row(btn('Zaxirani o\'chirish', async() => {
        if(!confirm('Zaxira serverdan va shu brauzerdan o\'chiriladi. Davom etasizmi?')) return;
        try { await disableBackup(true); viewOff(); } catch(e) { msg.append(note(errText(e), '#d33')); }
      }, true))
    );
    refresh();
  }

  async function showChats(list: HTMLElement) {
    const rows = await chatUsage();
    list.replaceChildren(h('b', {}, 'Zaxira chatlari'), note('Faqat shaxsiy chatlar (odam bilan yozishma) saqlanadi: guruh va kanallar yo\'q. Kerakmas chatni o\'chirib qo\'ysangiz, yangi xabarlari saqlanmaydi.'));
    const titles = new Map<string, string>();
    for(const e of rows.filter((x) => Number(x.peerId) > 0).slice(0, 300)) {
      titles.set(e.peerId, await peerTitle(e.peerId));
      let on = chatEnabled(e.peerId);
      const box = h('span', {style: 'flex:none;width:24px;height:24px;border-radius:7px;border:2px solid var(--primary-color,#3390ec);display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;line-height:1;'});
      const paint = () => { box.textContent = on ? '✓' : ''; box.style.background = on ? 'var(--primary-color,#3390ec)' : 'transparent'; };
      paint();
      const item = Object.assign(h('div', {style: 'display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid rgba(127,127,127,.2);cursor:pointer;user-select:none;'}, box,
        h('div', {style: 'flex:1;min-width:0'}, h('div', {style: 'font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'}, titles.get(e.peerId) || e.peerId),
          h('div', {style: 'font-size:12px;opacity:.7'}, `${e.msgs} xabar${e.files ? ` · ${e.files} fayl` : ''} · ${fmtSize(e.bytes)}`))), {role: 'checkbox', tabIndex: 0,
        onclick: () => { on = !on; setChatEnabled(e.peerId, on); paint(); }});
      list.append(item);
    }
    if(!rows.length) list.append(note('Hozircha saqlangan chat yo\'q.'));
  }

  async function showDeleted(list: HTMLElement) {
    const items = await archive.deletedMessages();
    list.replaceChildren(h('b', {}, `O'chirilgan xabarlar (${items.length})`));
    if(!items.length) { list.append(note('Hozircha yo\'q. Boshqalar xabarni o\'chirsa, shu yerda ko\'rinadi.')); return; }
    const titles = new Map<string, string>();
    for(const m of items.slice(0, 200)) {
      if(!titles.has(m.peerId)) titles.set(m.peerId, await peerTitle(m.peerId));
      const voice = await archive.voiceOf(m.peerId, m.mid);
      const player = voice ? [Object.assign(h('audio', {style: 'width:100%;margin-top:4px;'}), {controls: true, preload: 'none', src: URL.createObjectURL(new Blob([Uint8Array.from(atob(voice.b64), (c) => c.charCodeAt(0))], {type: voice.mime}))})] : [];
      const fileM = await archive.mediaOf(m.peerId, m.mid);
      const toBlob = (parts: string[], mime: string) => URL.createObjectURL(new Blob(parts.map((x) => Uint8Array.from(atob(x), (c) => c.charCodeAt(0))), {type: mime}));
      const fileEl = fileM ? [fileM.kind === 'photo' ? Object.assign(h('img', {style: 'max-width:100%;border-radius:10px;margin-top:4px;'}), {src: toBlob(fileM.b64, fileM.mime)}) : Object.assign(h('video', {style: 'max-width:240px;width:100%;border-radius:50%;margin-top:4px;aspect-ratio:1/1;object-fit:cover;'}), {controls: true, preload: 'none', src: toBlob(fileM.b64, fileM.mime)})] : [];
      list.append(h('div', {style: 'padding:8px 0;border-bottom:1px solid rgba(127,127,127,.2);'},
        h('div', {style: 'font-size:12px;opacity:.7'}, `${titles.get(m.peerId)} · ${fmtDate(m.date)} · o'chirilgan ${fmtDate(m.deleted!)}`),
        h('div', {style: 'white-space:pre-wrap;word-break:break-word;'}, m.text || (voice ? `Ovozli xabar${voice.dur ? ` (${voice.dur} s)` : ''}` : fileM ? (fileM.kind === 'photo' ? 'Rasm' : 'Dumaloq video') : m.kind ? `[${m.kind.replace('messageMedia', '')}]` : '')),
        ...player,
        ...fileEl,
        ...(m.edits?.length ? [h('div', {style: 'font-size:12px;opacity:.7'}, `Tahrirlangan (${m.edits.length}): oldingi: ` + m.edits.map((e) => e.text).join(' → '))] : [])));
    }
  }

  (isEnabled() ? viewOn : viewOff)();
}

export {normalizeCode, serverUrl};
