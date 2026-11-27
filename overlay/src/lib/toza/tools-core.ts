// Toza qo'shimcha imkoniyatlari: arxivdan qidirish, statistika, eksport. Hammasi BRAUZERNING ICHIDA (serverga hech narsa yuborilmaydi).
// Sof mantiq (tweb'ga bog'liq emas): node testlari bilan tekshiriladi.
import {isBlobKey} from './core.ts';
import type {ArchivedMessage} from './core.ts';

export type SearchOpts = {peerId?: string; deletedOnly?: boolean; editedOnly?: boolean; from?: number; to?: number; limit?: number};

const norm = (s: string) => s.toLocaleLowerCase();

/** Saqlangan xabarlar ichidan qidirish (matn, tahrir tarixi). Yangisi birinchi. `from/to` — sekund. */
export function searchArchive(all: ArchivedMessage[], q: string, o: SearchOpts = {}): ArchivedMessage[] {
  const needle = norm(q.trim());
  const out = all.filter((m) => {
    if(isBlobKey(m.k)) return false;
    if(o.peerId && m.peerId !== o.peerId) return false;
    if(o.deletedOnly && !m.deleted) return false;
    if(o.editedOnly && !m.edits?.length) return false;
    if(o.from && m.date < o.from) return false;
    if(o.to && m.date > o.to) return false;
    if(!needle) return true;
    return norm(m.text).includes(needle) || !!m.edits?.some((e) => norm(e.text).includes(needle));
  }).sort((a, b) => b.date - a.date);
  return o.limit ? out.slice(0, o.limit) : out;
}

export type ChatStat = {peerId: string; msgs: number; deleted: number; edited: number; mine: number; theirs: number; files: number; bytes: number};
export type Stats = {messages: number; deleted: number; edited: number; voices: number; files: number; bytes: number; byChat: ChatStat[]; byDay: {day: string; n: number}[]; byHour: number[]};

const dayKey = (sec: number) => new Date(sec * 1000).toISOString().slice(0, 10);

/** Statistika: jami, chatlar bo'yicha (joy egallashi bilan), oxirgi 30 kun va soatlar bo'yicha faollik. */
export function computeStats(all: ArchivedMessage[], nowSec = Math.floor(Date.now() / 1000), days = 30): Stats {
  const st: Stats = {messages: 0, deleted: 0, edited: 0, voices: 0, files: 0, bytes: 0, byChat: [], byDay: [], byHour: new Array(24).fill(0)};
  const chats = new Map<string, ChatStat>();
  const perDay = new Map<string, number>();
  const chat = (id: string) => {
    let c = chats.get(id);
    if(!c) { c = {peerId: id, msgs: 0, deleted: 0, edited: 0, mine: 0, theirs: 0, files: 0, bytes: 0}; chats.set(id, c); }
    return c;
  };
  for(const m of all) {
    const c = chat(m.peerId);
    if(isBlobKey(m.k)) {
      const b = Math.floor(((m.voice?.b64.length || 0) + (m.media?.b64.length || 0)) * 3 / 4);
      c.bytes += b; st.bytes += b;
      if(m.voice) { st.voices++; c.files++; st.files++; } else if(m.media?.i === 0) { c.files++; st.files++; }
      continue;
    }
    const size = JSON.stringify(m).length;
    c.bytes += size; st.bytes += size;
    c.msgs++; st.messages++;
    if(m.deleted) { c.deleted++; st.deleted++; }
    if(m.edits?.length) { c.edited++; st.edited++; }
    if(m.out) c.mine++; else c.theirs++;
    perDay.set(dayKey(m.date), (perDay.get(dayKey(m.date)) || 0) + 1);
    st.byHour[new Date(m.date * 1000).getUTCHours()]++;
  }
  st.byChat = [...chats.values()].sort((a, b) => b.bytes - a.bytes);
  for(let i = days - 1; i >= 0; i--) { const d = dayKey(nowSec - i * 86400); st.byDay.push({day: d, n: perDay.get(d) || 0}); }
  return st;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const fmtStamp = (sec: number) => { const d = new Date(sec * 1000); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };

/** Bitta chatning xabarlari vaqt bo'yicha (eksport uchun). */
export const chatMessages = (all: ArchivedMessage[], peerId: string) =>
  all.filter((m) => m.peerId === peerId && !isBlobKey(m.k)).sort((a, b) => a.date - b.date || a.mid - b.mid);

/** Oddiy matnli eksport (.txt): vaqt, kim, matn, tahrir tarixi va o'chirilgan belgisi. */
export function exportText(all: ArchivedMessage[], peerId: string, title: string, meName = 'Siz'): string {
  const lines = [`Chat: ${title}`, `Eksport: ${fmtStamp(Math.floor(Date.now() / 1000))}`, ''];
  for(const m of chatMessages(all, peerId)) {
    const who = m.out ? meName : title;
    const media = !m.text && m.kind ? `[${m.kind.replace('messageMedia', '')}]` : '';
    lines.push(`[${fmtStamp(m.date)}] ${who}: ${m.text || media}${m.deleted ? '  (o\'chirilgan ' + fmtStamp(m.deleted) + ')' : ''}`);
    for(const e of m.edits || []) lines.push(`    oldingi (${fmtStamp(e.t)}): ${e.text}`);
  }
  return lines.join('\n') + '\n';
}

export type MediaPack = {kind: string; mime: string; dur?: number; b64: string[]; name?: string};

/** Eksport uchun fayl HTML'i (data: manzil bilan). */
export function mediaHtml(pack: MediaPack, src: string): string {
  const k = pack.kind;
  if(k === 'photo' || (k === 'sticker' && !/webm/.test(pack.mime))) return `<img src="${src}" style="max-width:${k === 'sticker' ? '160px' : '100%'};border-radius:10px">`;
  if(k === 'voice' || k === 'audio') return `<audio controls src="${src}"></audio>`;
  if(k === 'file') return `<a href="${src}" download="${escHtml(pack.name || 'fayl')}">📎 ${escHtml(pack.name || 'Fayl')}</a>`;
  if(k === 'gif' || k === 'sticker') return `<video autoplay loop muted playsinline src="${src}" style="max-width:${k === 'sticker' ? '160px' : '100%'};border-radius:10px"></video>`;
  return `<video controls src="${src}" style="max-width:100%;border-radius:${k === 'round' ? '50%' : '10px'}"></video>`;
}
export const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** To'liq eksport (.html): bitta fayl, rasm/ovoz/video ichiga joylangan (data:). `maxMediaBytes` dan oshsa fayllar tashlab ketiladi. */
export function exportHtml(all: ArchivedMessage[], peerId: string, title: string, mediaOf: (mid: number) => MediaPack | undefined, opts: {meName?: string; maxMediaBytes?: number} = {}): {html: string; skipped: number} {
  const max = opts.maxMediaBytes ?? 150_000_000, me = opts.meName || 'Siz';
  let used = 0, skipped = 0;
  const parts: string[] = [];
  for(const m of chatMessages(all, peerId)) {
    let media = '';
    const pack = mediaOf(m.mid);
    if(pack) {
      const size = pack.b64.reduce((a, x) => a + x.length, 0) * 3 / 4;
      if(used + size > max) skipped++;
      else {
        used += size;
        const src = `data:${pack.mime};base64,${pack.b64.join('')}`;
        media = mediaHtml(pack, escHtml(src));
      }
    }
    const text = m.text ? `<div class="t">${escHtml(m.text).replace(/\n/g, '<br>')}</div>` : (!media && m.kind ? `<div class="t i">[${escHtml(m.kind.replace('messageMedia', ''))}]</div>` : '');
    const edits = (m.edits || []).map((e) => `<div class="e">oldingi (${fmtStamp(e.t)}): ${escHtml(e.text)}</div>`).join('');
    parts.push(`<div class="m ${m.out ? 'o' : 'n'}${m.deleted ? ' d' : ''}"><div class="h">${escHtml(m.out ? me : title)} · ${fmtStamp(m.date)}${m.deleted ? ' · o\'chirilgan ' + fmtStamp(m.deleted) : ''}</div>${text}${media}${edits}</div>`);
  }
  const css = 'body{font:15px/1.4 system-ui,sans-serif;max-width:640px;margin:0 auto;padding:16px;background:#f3f6fa;color:#16202e}.m{background:#fff;border-radius:14px;padding:10px 12px;margin:8px 0;box-shadow:0 1px 3px rgba(0,0,0,.08)}.o{background:#e3f1ff}.d{border-left:4px solid #e8860c}.h{font-size:12px;opacity:.65;margin-bottom:4px}.e{font-size:12px;opacity:.7;margin-top:4px}.i{opacity:.7;font-style:italic}';
  const html = `<!doctype html><html lang="uz"><meta charset="utf-8"><title>${escHtml(title)}</title><style>${css}</style><h2>${escHtml(title)}</h2>${skipped ? `<p><b>${skipped} ta fayl hajmi katta bo'lgani uchun qo'shilmadi.</b></p>` : ''}${parts.join('\n')}</html>`;
  return {html, skipped};
}

/** Shablonlar (tezkor javoblar): matnli, mahalliy. */
export type Template = {id: string; title: string; text: string};
export const newTemplate = (title: string, text: string, id = Math.random().toString(36).slice(2, 9)): Template => ({id, title: title.trim().slice(0, 40) || text.trim().slice(0, 30), text: text.trim().slice(0, 2000)});

// ---------------------------------------------------------------- JSON eksport (hamma yoki tanlangan chatlar)
export function exportJson(all: ArchivedMessage[], chats: {peerId: string; title: string}[], nowSec = Math.floor(Date.now() / 1000)): string {
  return JSON.stringify({app: 'Toza', v: 1, exported: nowSec, chats: chats.map(({peerId, title}) => ({
    peerId, title,
    messages: chatMessages(all, peerId).map((m) => ({mid: m.mid, date: m.date, out: !!m.out, text: m.text, ...(m.kind ? {kind: m.kind} : {}), ...(m.edits?.length ? {edits: m.edits} : {}), ...(m.deleted ? {deleted: m.deleted} : {}), ...(m.once ? {once: true} : {})}))
  }))}, null, 1);
}

// ---------------------------------------------------------------- kalit so'zlar
const apos = (s: string) => s.replace(/[ʻʼ‘’`´]/g, '\'');
/** «olma, Toshkent\nish» -> ['olma', 'toshkent', 'ish'] (takrorsiz, 2 harfdan uzun, 50 tagacha). */
export const parseKeywords = (raw: string): string[] => [...new Set(apos(raw).split(/[,\n;]+/).map((x) => x.trim().toLocaleLowerCase()).filter((x) => x.length >= 2))].slice(0, 50);
/** Matnda kalit so'z bormi (so'z boshidan, katta-kichik harf va tutuq belgisi farqsiz). Qaytaradi: topilgan so'z yoki ''. */
export function matchKeyword(text: string, keywords: string[]): string {
  if(!text || !keywords.length) return '';
  const t = apos(text).toLocaleLowerCase();
  for(const k of keywords) {
    let i = t.indexOf(k);
    while(i !== -1) {
      if(i === 0 || !/[\p{L}\p{N}']/u.test(t[i - 1])) return k;
      i = t.indexOf(k, i + 1);
    }
  }
  return '';
}

// ---------------------------------------------------------------- lotin <-> kirill (o'zbek yozuvi)
const L2C_DI: [string, string][] = [['o\'', 'ў'], ['g\'', 'ғ'], ['sh', 'ш'], ['ch', 'ч'], ['yo', 'ё'], ['yu', 'ю'], ['ya', 'я'], ['ye', 'е']];
const L2C: Record<string, string> = {a: 'а', b: 'б', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'ҳ', i: 'и', j: 'ж', k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п', q: 'қ', r: 'р', s: 'с', t: 'т', u: 'у', v: 'в', x: 'х', y: 'й', z: 'з', c: 'с', w: 'в', '\'': 'ъ'};
const C2L: Record<string, string> = {а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '\'', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya', ў: 'o\'', қ: 'q', ғ: 'g\'', ҳ: 'h'};
const isUp = (c: string) => c !== c.toLocaleLowerCase() && c === c.toLocaleUpperCase();
const isLetter = (c: string | undefined) => !!c && /\p{L}/u.test(c);
const caseAs = (src: string, out: string, nextUp: boolean) => !isUp(src[0]) ? out : (src.length > 1 ? (isUp(src[1]) ? out.toLocaleUpperCase() : out[0].toLocaleUpperCase() + out.slice(1)) : (nextUp ? out.toLocaleUpperCase() : out[0].toLocaleUpperCase() + out.slice(1)));

/** Lotin -> kirill. «e» so'z boshida «э»; «sh, ch, o', g', yo, yu, ya» bitta harf. Havolalar (http..., @nom) o'zgarmaydi. */
export function latinToCyrillic(text: string): string {
  return apos(text).split(/(\s+)/).map((w) => /^(https?:\/\/|www\.|@|#)/i.test(w) ? w : convL2C(w)).join('');
}
function convL2C(w: string): string {
  let out = '';
  for(let i = 0; i < w.length;) {
    const lower = w.slice(i, i + 2).toLocaleLowerCase();
    const di = L2C_DI.find(([l]) => l === lower);
    const atStart = !isLetter(w[i - 1]);
    if(di && !(di[0] === 'ye' && !atStart) && !(di[0] === 'yo' && w[i + 2] === '\'')) {          // «yo'l» = й + ў
      out += caseAs(w.slice(i, i + 2), di[1], isUp(w[i + 2] || ''));
      i += 2; continue;
    }
    const c = w[i], lc = c.toLocaleLowerCase();
    const mapped = lc === 'e' && atStart ? 'э' : lc === '\'' ? (isLetter(w[i - 1]) ? 'ъ' : c) : L2C[lc];
    out += mapped ? caseAs(c, mapped, isUp(w[i + 1] || '') && isUp(w[i - 1] || '')) : c;
    i++;
  }
  return out;
}

/** Kirill -> lotin. «е» so'z boshida «ye». */
export function cyrillicToLatin(text: string): string {
  let out = '';
  for(let i = 0; i < text.length; i++) {
    const c = text[i], lc = c.toLocaleLowerCase();
    let m = C2L[lc];
    if(m === undefined) { out += c; continue; }
    if(lc === 'е' && !isLetter(text[i - 1])) m = 'ye';
    if(!m) continue;
    out += isUp(c) ? ((isUp(text[i + 1] || '') || isUp(text[i - 1] || '')) && isLetter(text[i + 1]) || (isUp(text[i - 1] || '') && !isLetter(text[i + 1])) ? m.toLocaleUpperCase() : m[0].toLocaleUpperCase() + m.slice(1)) : m;
  }
  return out;
}
export const hasCyrillic = (s: string) => /[Ѐ-ӿ]/.test(s);

// ---------------------------------------------------------------- o'zbekcha matnni aniqlash (rus/ingliz matnini buzmaslik uchun)
const UZ_CYR_ONLY = /[ўқғҳЎҚҒҲ]/;
const UZ_CYR_WORDS = /(^|[^\p{L}])(ва|бу|мен|сен|бир|учун|билан|ҳам|эмас|нима|қандай|керак|бор|йўқ|яхши|рахмат|раҳмат|ассалому|салом|қалай|сиз|биз|улар|шу|ўша|энди|ҳозир|кейин|олдин|катта|кичик|бугун|эртага)(?=$|[^\p{L}])/giu;
const RU_ONLY = /[ыщэъЫЩЭЪ]|(^|[^\p{L}])(что|это|как|так|не|на|он|она|они|мы|вы|да|нет|привет|спасибо|хорошо|когда|где|почему|который|только|если|уже|очень)(?=$|[^\p{L}])/iu;
const UZ_LAT_MARK = /[oOgG]['ʻʼ‘’`]|(^|[^\p{L}])\p{L}*q\p{L}*/u;
const UZ_LAT_WORDS = /(^|[^\p{L}'])(va|bu|men|sen|bir|uchun|bilan|ham|emas|nima|qanday|kerak|bor|yo'q|yaxshi|rahmat|assalomu|salom|qalay|siz|biz|ular|shu|o'sha|endi|hozir|keyin|oldin|katta|kichik|bugun|ertaga|edi|ekan|bo'ldi|qildi|aka|opa|xop|xo'p|mayli)(?=$|[^\p{L}'])/giu;
const count = (re: RegExp, s: string) => (s.match(re) || []).length;

/** Kirillcha matn o'zbekchami (rus emasmi): o'zbekcha harflar (ў қ ғ ҳ) yoki o'zbekcha so'zlar bor, ruscha belgilar yo'q. */
export function isUzbekCyrillic(text: string): boolean {
  if(!/[Ѐ-ӿ]/.test(text)) return false;
  if(UZ_CYR_ONLY.test(text)) return true;
  if(RU_ONLY.test(text)) return false;
  return count(UZ_CYR_WORDS, text) >= 1;
}
/** Lotincha matn o'zbekchami (ingliz emasmi): o' / g' / q harfi yoki kamida ikkita o'zbekcha so'z. */
export function isUzbekLatin(text: string): boolean {
  if(!/[a-z]/i.test(text) || /[Ѐ-ӿ]/.test(text)) return false;
  const t = apos(text);
  const words = count(UZ_LAT_WORDS, t);
  if(/[og]'/i.test(t)) return true;
  return words >= 2 || (words >= 1 && UZ_LAT_MARK.test(t));
}
/** Ko'rsatish uchun: tanlangan yozuvga o'giradi, faqat o'zbekcha bo'lsa (aks holda o'zgarmaydi). */
export function toScript(text: string, to: 'lat' | 'cyr'): string {
  if(to === 'lat') return isUzbekCyrillic(text) ? cyrillicToLatin(text) : text;
  return isUzbekLatin(text) ? latinToCyrillic(text) : text;
}

// ---------------------------------------------------------------- kontaktlarni saralash
export type ContactInfo = {id: string; name: string; phone?: string; deleted?: boolean; bot?: boolean; status?: {_: string; was_online?: number; expires?: number}; hasChat: boolean};
export type ContactFilter = 'all' | 'inactiveMonth' | 'inactiveWeek' | 'deleted' | 'noChat' | 'noPhone';
const DAY = 86400;
/** Oxirgi ko'ringan vaqt (sekund, taxminiy): saralash uchun. Yashirin/uzoq vaqt — 0. */
export function lastSeen(c: ContactInfo, now: number): number {
  const s = c.status;
  switch(s?._) {
    case 'userStatusOnline': return now;
    case 'userStatusOffline': return s.was_online || 0;
    case 'userStatusRecently': return now - 2 * DAY;
    case 'userStatusLastWeek': return now - 6 * DAY;
    case 'userStatusLastMonth': return now - 29 * DAY;
    default: return 0;                                                 // userStatusEmpty: «uzoq vaqt oldin»
  }
}
/** Kontakt shu toifagami. «Uzoq kirmagan»: o'chirilgan akkaunt ham kiradi. */
export function matchContact(c: ContactInfo, f: ContactFilter, now: number): boolean {
  switch(f) {
    case 'all': return true;
    case 'deleted': return !!c.deleted;
    case 'noChat': return !c.hasChat;
    case 'noPhone': return !c.phone;
    case 'inactiveWeek': return c.deleted || (c.status?._ === 'userStatusOffline' ? lastSeen(c, now) < now - 7 * DAY : ['userStatusLastMonth', 'userStatusEmpty', undefined].includes(c.status?._));
    case 'inactiveMonth': return c.deleted || (c.status?._ === 'userStatusOffline' ? lastSeen(c, now) < now - 30 * DAY : c.status?._ === 'userStatusEmpty' || !c.status);
  }
}
export function sortContacts(list: ContactInfo[], by: 'name' | 'seen', now: number): ContactInfo[] {
  return [...list].sort(by === 'name' ? (a, b) => a.name.localeCompare(b.name) : (a, b) => lastSeen(a, now) - lastSeen(b, now) || a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------- pleyer va ko'z asrash
/** 75 → «1:15», 3725 → «1:02:05». */
export function fmtTime(s: number): string {
  s = Math.max(0, Math.floor(s || 0));
  const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, sec = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(sec)}` : `${m}:${p(sec)}`;
}
/** Vaqtni siljitish (0 va davomiylik orasida). */
export const nextSeek = (cur: number, dur: number, by: number) => Math.min(Math.max(0, cur + by), Math.max(0, dur - 0.1));
/** Saqlangan joydan davom ettirish kerakmi: boshida yoki oxirida bo'lsa yo'q. */
export function resumeAt(saved: number | undefined, dur: number): number | null {
  if(!saved || !isFinite(dur) || dur < 90) return null;
  return saved >= 10 && saved <= dur - 15 ? saved : null;
}

export type EyeCare = {mode: 'off' | 'on' | 'night'; warm: 1 | 2 | 3; dim: 0 | 1 | 2 | 3; from: number; to: number};
/** Ko'z asrash hozir yoqilganmi (tungi rejimda soat oralig'iga qarab; oraliq yarim tundan o'tishi mumkin). */
export function eyeCareActive(c: EyeCare, hour: number): boolean {
  if(c.mode === 'off') return false;
  if(c.mode === 'on') return true;
  return c.from <= c.to ? hour >= c.from && hour < c.to : hour >= c.from || hour < c.to;
}
/** Filtr qatlamlari: iliq (ko'k nurni kamaytiradi, multiply) va xiralik. */
export function eyeCareLayers(c: EyeCare): {warm: string; dim: number} {
  const a = [0, 0.14, 0.24, 0.34][c.warm] || 0.14;
  return {warm: `rgba(255, 140, 40, ${a})`, dim: [0, 0.12, 0.24, 0.36][c.dim] || 0};
}

// ---------------------------------------------------------------- kanal va guruhlarni saralash
export type ChatInfo = {id: string; name: string; kind: 'channel' | 'group' | 'user' | 'bot'; deleted?: boolean; unread: number; lastMsg: number; muted: boolean; archived: boolean; opened?: number};
export type ChatFilter = 'all' | 'channels' | 'groups' | 'private' | 'bots' | 'deleted' | 'notOpened' | 'unreadMany' | 'unread' | 'silent' | 'muted' | 'archived';
/** Toza qachondan beri ochilgan chatlarni eslab boryapti (sekund) — shunga qarab «ochilmagan» hisoblanadi. */
export function notOpened(c: ChatInfo, now: number, trackSince: number, days = 30): boolean {
  const edge = now - days * DAY;
  if(c.opened) return c.opened < edge;
  if(trackSince && trackSince <= edge) return true;                  // kuzatuv uzoq yurgan, lekin bir marta ham ochilmagan
  return c.unread >= 20;                                              // kuzatuv yangi: ko'p o'qilmagan bo'lsa, demak ochilmagan
}
export function matchChat(c: ChatInfo, f: ChatFilter, now: number, trackSince = 0): boolean {
  switch(f) {
    case 'all': return true;
    case 'channels': return c.kind === 'channel';
    case 'groups': return c.kind === 'group';
    case 'private': return c.kind === 'user';
    case 'bots': return c.kind === 'bot';
    case 'deleted': return !!c.deleted;
    case 'notOpened': return notOpened(c, now, trackSince);
    case 'unreadMany': return c.unread >= 50;
    case 'unread': return c.unread > 0;
    case 'silent': return !!c.lastMsg && c.lastMsg < now - 30 * DAY;
    case 'muted': return c.muted;
    case 'archived': return c.archived;
  }
}
export function sortChats(list: ChatInfo[], by: 'unread' | 'opened' | 'active' | 'name'): ChatInfo[] {
  const byName = (a: ChatInfo, b: ChatInfo) => a.name.localeCompare(b.name);
  const cmp: Record<typeof by, (a: ChatInfo, b: ChatInfo) => number> = {
    unread: (a, b) => b.unread - a.unread || byName(a, b),
    opened: (a, b) => (a.opened || 0) - (b.opened || 0) || b.unread - a.unread,
    active: (a, b) => (a.lastMsg || 0) - (b.lastMsg || 0) || byName(a, b),
    name: byName
  };
  return [...list].sort(cmp[by]);
}
/** «3 kun oldin», «2 oy oldin». */
export function agoText(sec: number, now: number): string {
  if(!sec) return '';
  const d = Math.floor((now - sec) / DAY);
  return d < 1 ? 'bugun' : d < 30 ? `${d} kun oldin` : d < 365 ? `${Math.floor(d / 30)} oy oldin` : `${Math.floor(d / 365)} yil oldin`;
}
