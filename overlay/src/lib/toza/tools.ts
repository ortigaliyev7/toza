// Toza qo'shimcha imkoniyatlari oynalari: qidiruv, statistika, eksport, shablonlar, qulf (PIN).
// Hammasi brauzer ichida: matn serverga yuborilmaydi (zaxira nol bilim bo'lib qoladi).
import {archive, peerTitle, store as archiveStore} from './hooks';
import {chatMessages, computeStats, exportHtml, exportText, fmtStamp, newTemplate, searchArchive} from './tools-core';
import type {MediaPack, Template} from './tools-core';

export type Ctx = {
  h: (tag: any, props?: any, ...kids: (Node | string)[]) => any;
  title: (t: string) => HTMLElement;
  note: (t: string, color?: string) => HTMLElement;
  row: (...k: (Node | string)[]) => HTMLElement;
  btn: (t: string, fn: (b: HTMLButtonElement) => any, secondary?: boolean) => HTMLButtonElement;
  show: (...nodes: Node[]) => void;
  back: () => void;
  BTN2: string;
};

const INPUT = 'width:100%;box-sizing:border-box;padding:10px;border-radius:10px;border:1px solid rgba(127,127,127,.4);background:transparent;color:inherit;font:inherit;';
const fmtSize = (n: number) => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.ceil(n / 1024) + ' KB';

async function allMessages() { return archiveStore.all(); }

async function chatChoices(): Promise<{peerId: string; label: string}[]> {
  const ids = [...new Set((await allMessages()).filter((m) => Number(m.peerId) > 0).map((m) => m.peerId))];
  return Promise.all(ids.map(async(id) => ({peerId: id, label: await peerTitle(id)})));
}

const download = (name: string, text: BlobPart, type: string) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], {type}));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
};

/** Chat tanlash ro'yxati (select). */
async function chatSelect(c: Ctx, withAll: boolean) {
  const opts = await chatChoices();
  const sel = c.h('select', {style: INPUT}, ...(withAll ? [Object.assign(c.h('option', {}, 'Hamma chatlar'), {value: ''})] : []), ...opts.map((o) => Object.assign(c.h('option', {}, o.label), {value: o.peerId})));
  return sel as HTMLSelectElement;
}

// ---------------------------------------------------------------- qidiruv
export async function viewSearch(c: Ctx, presetPeer = '', presetDeleted = false) {
  const q = c.h('input', {placeholder: 'Qidirish: so\'z yoki ibora', style: INPUT});
  const sel = await chatSelect(c, true);
  sel.value = presetPeer;
  const del = c.h('input', {type: 'checkbox'}); del.checked = presetDeleted;
  const out = c.h('div');
  const run = async() => {
    const found = searchArchive(await allMessages(), q.value, {peerId: sel.value || undefined, deletedOnly: del.checked, limit: 100});
    const titles = new Map<string, string>();
    out.replaceChildren(c.note(`Topildi: ${found.length}${found.length === 100 ? '+' : ''}`));
    for(const m of found) {
      if(!titles.has(m.peerId)) titles.set(m.peerId, await peerTitle(m.peerId));
      out.append(c.h('div', {style: 'padding:8px 0;border-bottom:1px solid rgba(127,127,127,.2);'},
        c.h('div', {style: 'font-size:12px;opacity:.7'}, `${titles.get(m.peerId)} · ${fmtStamp(m.date)}${m.out ? ' · siz' : ''}${m.deleted ? ' · o\'chirilgan' : ''}`),
        c.h('div', {style: 'white-space:pre-wrap;word-break:break-word;'}, m.text || (m.kind ? `[${m.kind.replace('messageMedia', '')}]` : '')),
        ...(m.edits?.length ? [c.h('div', {style: 'font-size:12px;opacity:.7'}, 'Oldingi: ' + m.edits.map((e) => e.text).join(' → '))] : [])));
    }
  };
  q.oninput = () => { clearTimeout((q as any).t); (q as any).t = setTimeout(run, 250); };
  sel.onchange = run; del.onchange = run;
  c.show(c.title('Arxivdan qidirish'), q, c.row(sel), c.h('label', {style: 'display:flex;gap:8px;align-items:center;margin:6px 0;'}, del, 'Faqat o\'chirilganlar'), out, c.row(c.btn('Orqaga', c.back, true)));
  run();
}

// ---------------------------------------------------------------- statistika
export async function viewStats(c: Ctx) {
  const all = await allMessages();
  const st = computeStats(all);
  const peak = Math.max(1, ...st.byDay.map((d) => d.n));
  const bars = c.h('div', {style: 'display:flex;align-items:flex-end;gap:2px;height:60px;margin:6px 0;'},
    ...st.byDay.map((d) => c.h('div', {title: `${d.day}: ${d.n}`, style: `flex:1;background:var(--primary-color,#3390ec);border-radius:2px 2px 0 0;height:${Math.max(2, Math.round(d.n / peak * 60))}px;opacity:${d.n ? 1 : .25}`})));
  const topHour = st.byHour.indexOf(Math.max(...st.byHour));
  const list = c.h('div');
  for(const ch of st.byChat.filter((x) => Number(x.peerId) > 0).slice(0, 15)) {
    list.append(c.h('div', {style: 'display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid rgba(127,127,127,.2);'},
      c.h('div', {style: 'min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'}, await peerTitle(ch.peerId)),
      c.h('div', {style: 'flex:none;font-size:12px;opacity:.75;text-align:end'}, `${ch.msgs} xabar (${ch.mine} siz / ${ch.theirs} u) · ${fmtSize(ch.bytes)}`)));
  }
  c.show(c.title('Statistika'),
    c.note(`Saqlangan: ${st.messages} xabar · o'chirilgan: ${st.deleted} · tahrirlangan: ${st.edited} · ovoz: ${st.voices} · fayl: ${st.files} · hajmi: ${fmtSize(st.bytes)}`),
    c.h('b', {}, 'Oxirgi 30 kun'), bars,
    c.note(st.messages ? `Eng faol soat: ${String(topHour).padStart(2, '0')}:00 (UTC)` : 'Hozircha ma\'lumot yo\'q.'),
    c.h('b', {}, 'Chatlar (joy bo\'yicha)'), list,
    c.row(c.btn('Orqaga', c.back, true)));
}

// ---------------------------------------------------------------- eksport
export async function viewExport(c: Ctx) {
  const sel = await chatSelect(c, false);
  const msg = c.h('div');
  const build = async(full: boolean) => {
    msg.replaceChildren();
    if(!sel.value) { msg.append(c.note('Chatni tanlang.', '#d33')); return; }
    const all = await allMessages();
    const title = await peerTitle(sel.value);
    const safe = title.replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 40) || 'chat';
    if(!full) { download(`toza-${safe}.txt`, exportText(all, sel.value, title), 'text/plain;charset=utf-8'); msg.append(c.note('Tayyor: matnli fayl yuklandi.', '#2a9d4b')); return; }
    const mids = chatMessages(all, sel.value).map((m) => m.mid);
    const packs = new Map<number, MediaPack>();
    for(const mid of mids) {
      const v = await archive.voiceOf(sel.value, mid), f = await archive.mediaOf(sel.value, mid);
      if(v) packs.set(mid, {kind: 'voice', mime: v.mime, dur: v.dur, b64: [v.b64]});
      else if(f) packs.set(mid, {kind: f.kind, mime: f.mime, dur: f.dur, b64: f.b64, name: f.name});
    }
    const {html, skipped} = exportHtml(all, sel.value, title, (mid) => packs.get(mid));
    download(`toza-${safe}.html`, html, 'text/html;charset=utf-8');
    msg.append(c.note(`Tayyor: to'liq fayl yuklandi (${packs.size} ta fayl)${skipped ? `, ${skipped} ta katta fayl qo'shilmadi` : ''}.`, '#2a9d4b'));
  };
  c.show(c.title('Chatni eksport qilish'),
    c.note('Tanlangan chatning saqlangan nusxasi bitta faylga yig\'iladi. Fayl faqat shu qurilmada yaratiladi.'), sel,
    c.row(c.btn('Matn (.txt)', () => build(false)), c.btn('To\'liq (.html, fayllar bilan)', () => build(true), true)),
    msg, c.row(c.btn('Orqaga', c.back, true)));
}

// ---------------------------------------------------------------- shablonlar
const LS_TPL = 'toza_templates';
const loadTpl = (): Template[] => { try { const a = JSON.parse(localStorage.getItem(LS_TPL) || '[]'); return Array.isArray(a) ? a : []; } catch{ return []; } };
const saveTpl = (l: Template[]) => localStorage.setItem(LS_TPL, JSON.stringify(l.slice(0, 50)));

/** Ochiq chatning yozish maydoniga matn qo'yadi (bo'lmasa nusxalaydi). */
function insertIntoComposer(text: string): boolean {
  const el = document.querySelector('.chat-input [contenteditable="true"], .input-message-input[contenteditable="true"]') as HTMLElement | null;
  if(!el) return false;
  el.focus();
  return document.execCommand('insertText', false, text);
}

export function viewTemplates(c: Ctx) {
  const list = c.h('div');
  const msg = c.h('div');
  const render = () => {
    list.replaceChildren();
    const all = loadTpl();
    if(!all.length) list.append(c.note('Hozircha shablon yo\'q. Pastdan qo\'shing.'));
    for(const t of all) {
      list.append(c.h('div', {style: 'padding:8px 0;border-bottom:1px solid rgba(127,127,127,.2);'},
        c.h('b', {}, t.title), c.h('div', {style: 'white-space:pre-wrap;opacity:.85;margin:2px 0 6px;'}, t.text),
        c.row(
          c.btn('Chatga qo\'yish', async() => {
            if(insertIntoComposer(t.text)) msg.replaceChildren(c.note('Yozish maydoniga qo\'yildi: chatni oching va yuboring.', '#2a9d4b'));
            else { await navigator.clipboard?.writeText(t.text); msg.replaceChildren(c.note('Chat ochiq emas: matn nusxalandi.', '#2a9d4b')); }
          }),
          c.btn('Nusxalash', async() => { await navigator.clipboard?.writeText(t.text); msg.replaceChildren(c.note('Nusxalandi.', '#2a9d4b')); }, true),
          c.btn('O\'chirish', () => { saveTpl(loadTpl().filter((x) => x.id !== t.id)); render(); }, true))));
    }
  };
  const ttl = c.h('input', {placeholder: 'Nomi (ixtiyoriy)', style: INPUT});
  const txt = c.h('textarea', {placeholder: 'Matn: masalan, «Rahmat, tez orada javob beraman»', rows: 3, style: INPUT + 'margin-top:6px;'});
  c.show(c.title('Tezkor javob shablonlari'),
    c.note('Shablonlar faqat shu brauzerda saqlanadi. Xabarni rejalashtirib yuborish uchun Telegram\'ning o\'z imkoniyatidan foydalaning: yuborish tugmasini bosib turing (kompyuterda o\'ng tugma) → «Keyinroq yuborish».'),
    list, c.h('hr', {style: 'border:0;border-top:1px solid rgba(127,127,127,.3);margin:12px 0'}), c.h('b', {}, 'Yangi shablon'), ttl, txt,
    c.row(c.btn('Qo\'shish', () => { if(!txt.value.trim()) return; saveTpl([...loadTpl(), newTemplate(ttl.value, txt.value)]); ttl.value = ''; txt.value = ''; render(); })),
    msg, c.row(c.btn('Orqaga', c.back, true)));
  render();
}

// ---------------------------------------------------------------- qulf (PIN)
export function viewLock(c: Ctx) {
  const lock = (window as any).__tozaLock;
  const msg = c.h('div');
  if(!lock) { c.show(c.title('Toza qulfi'), c.note('Qulf bu sahifada mavjud emas.'), c.row(c.btn('Orqaga', c.back, true))); return; }
  const pin = c.h('input', {type: 'password', inputMode: 'numeric', maxLength: 12, placeholder: lock.has() ? 'Joriy PIN' : 'Yangi PIN (4–12 belgi)', style: INPUT});
  const mins = c.h('input', {type: 'number', min: 0, max: 1440, value: String(lock.minutes()), style: INPUT + 'width:90px;'});
  const render = () => {
    const on = lock.has();
    c.show(c.title('Toza qulfi (PIN)'),
      c.note(on ? 'Qulf yoqilgan: Toza ochilganda va ' + lock.minutes() + ' daqiqadan ortiq fonda turgandan keyin PIN so\'raladi.' : 'PIN o\'rnatsangiz, Toza ochilganda PIN so\'raydi. Telefon boshqa qo\'lga tushsa Telegram darrov ochilmaydi.'),
      c.note('Eslatma: bu ko\'z o\'ngidagi to\'siq, xabarlarni shifrlamaydi. PIN unutilsa, brauzerda Toza ma\'lumotlarini o\'chirib qayta kirasiz (zaxira kodi bilan tiklanadi).'),
      pin,
      on ? c.row(c.btn('Qulfni o\'chirish', async() => { msg.replaceChildren(); if(await lock.clear(pin.value)) render(); else msg.append(c.note('PIN noto\'g\'ri.', '#d33')); }, true), c.btn('Hozir qulflash', () => lock.lockNow()))
        : c.row(c.btn('PIN o\'rnatish', async() => { msg.replaceChildren(); try { await lock.set(pin.value); render(); } catch{ msg.append(c.note('PIN 4–12 belgi bo\'lsin.', '#d33')); } })),
      c.h('div', {style: 'display:flex;gap:8px;align-items:center;margin:8px 0;'}, 'Fonda turgach qulflash (daqiqa):', mins, c.btn('Saqlash', () => { lock.setMinutes(mins.value); render(); }, true)),
      msg, c.row(c.btn('Orqaga', c.back, true)));
  };
  render();
}
