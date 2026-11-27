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
