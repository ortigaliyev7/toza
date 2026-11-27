// Toza qo'shimchalarining sof (DOM'siz) qismi: ZIP yig'ish (media markazi), foydalanish statistikasi, maxfiy chat PIN'i.
// Node testlarida ham ishlaydi: tests/extras.test.mjs

// ---------------------------------------------------------------- ZIP (siqmasdan, «store»)
let CRC_TABLE: Uint32Array | null = null;
export function crc32(data: Uint8Array, crc = 0): number {
  if(!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for(let n = 0; n < 256; n++) { let c = n; for(let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC_TABLE[n] = c >>> 0; }
  }
  let c = (crc ^ 0xFFFFFFFF) >>> 0;
  for(let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

export type ZipEntry = {name: string; data: Uint8Array; date?: Date};
const dosTime = (d: Date) => ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF;
const dosDate = (d: Date) => (((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;

/** Fayl nomini ZIP ichida takrorlanmaydigan va xavfsiz qiladi. */
export function uniqueName(name: string, used: Set<string>): string {
  const clean = (name || 'fayl').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').replace(/^\.+/, '').slice(0, 120) || 'fayl';
  const dot = clean.lastIndexOf('.');
  const base = dot > 0 ? clean.slice(0, dot) : clean, ext = dot > 0 ? clean.slice(dot) : '';
  let out = clean, i = 2;
  while(used.has(out.toLowerCase())) out = `${base} (${i++})${ext}`;
  used.add(out.toLowerCase());
  return out;
}

/** Fayllarni bitta ZIP'ga (siqmasdan) yig'adi. Rasm/video baribir siqilgan, shuning uchun tez va xotirani kam yeydi. */
export function buildZip(entries: ZipEntry[]): Uint8Array[] {
  const te = new TextEncoder();
  const parts: Uint8Array[] = [], central: Uint8Array[] = [];
  let offset = 0;
  for(const e of entries) {
    const name = te.encode(e.name), d = e.date || new Date(), crc = crc32(e.data), size = e.data.length;
    const lh = new Uint8Array(30 + name.length), lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true); lv.setUint16(8, 0, true);
    lv.setUint16(10, dosTime(d), true); lv.setUint16(12, dosDate(d), true); lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true); lv.setUint32(22, size, true); lv.setUint16(26, name.length, true); lv.setUint16(28, 0, true);
    lh.set(name, 30);
    const ch = new Uint8Array(46 + name.length), cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime(d), true); cv.setUint16(14, dosDate(d), true); cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true); cv.setUint32(24, size, true); cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true); ch.set(name, 46);
    parts.push(lh, e.data);
    central.push(ch);
    offset += lh.length + size;
  }
  const cdSize = central.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22), ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true); ev.setUint32(16, offset, true);
  return [...parts, ...central, end];
}

// ---------------------------------------------------------------- foydalanish statistikasi
export type DayUse = {s: number; o: number; i: number};          // soniya Toza ochiq, yuborilgan, kelgan
export type ChatUse = {o: number; i: number; n: number; t: number}; // yuborilgan, kelgan, ochilgan, oxirgi faollik
export type Usage = {since: number; days: Record<string, DayUse>; chats: Record<string, ChatUse>};
export const emptyUsage = (now = Date.now()): Usage => ({since: Math.floor(now / 1000), days: {}, chats: {}});
const p2 = (n: number) => String(n).padStart(2, '0');
export const localDay = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };

export function bumpDay(u: Usage, day: string, k: keyof DayUse, n = 1) {
  const d = u.days[day] ||= {s: 0, o: 0, i: 0};
  d[k] += n;
}
export function bumpChat(u: Usage, peerId: string, k: 'o' | 'i' | 'n', nowSec: number) {
  const c = u.chats[peerId] ||= {o: 0, i: 0, n: 0, t: 0};
  c[k]++; c.t = nowSec;
}
/** Eski kunlar (90 kundan ortiq) va kam faol chatlarni (300 tadan ortig'i) olib tashlaydi: localStorage to'lib ketmasin. */
export function pruneUsage(u: Usage, nowMs = Date.now(), keepDays = 90, maxChats = 300): Usage {
  const min = localDay(nowMs - keepDays * 86400000);
  for(const d of Object.keys(u.days)) if(d < min) delete u.days[d];
  const ids = Object.keys(u.chats);
  if(ids.length > maxChats) {
    ids.sort((a, b) => (u.chats[b].o + u.chats[b].i + u.chats[b].n) - (u.chats[a].o + u.chats[a].i + u.chats[a].n) || u.chats[b].t - u.chats[a].t);
    for(const id of ids.slice(maxChats)) delete u.chats[id];
  }
  return u;
}
export type UsageSummary = {series: {day: string; s: number; o: number; i: number}[]; sec: number; sent: number; recv: number; activeDays: number;
  top: {peerId: string; o: number; i: number; n: number}[]; topOpened: {peerId: string; n: number}[]};
export function summarizeUsage(u: Usage, nowMs = Date.now(), days = 7): UsageSummary {
  const series: UsageSummary['series'] = [];
  for(let k = days - 1; k >= 0; k--) {
    const day = localDay(nowMs - k * 86400000);
    const d = u.days[day] || {s: 0, o: 0, i: 0};
    series.push({day, ...d});
  }
  const sum = (k: keyof DayUse) => series.reduce((a, d) => a + d[k], 0);
  const chats = Object.entries(u.chats).map(([peerId, c]) => ({peerId, ...c}));
  return {
    series, sec: sum('s'), sent: sum('o'), recv: sum('i'), activeDays: series.filter((d) => d.s > 0 || d.o > 0).length,
    top: chats.filter((c) => c.o + c.i > 0).sort((a, b) => (b.o + b.i) - (a.o + a.i)).slice(0, 10).map(({peerId, o, i, n}) => ({peerId, o, i, n})),
    topOpened: chats.filter((c) => c.n > 0).sort((a, b) => b.n - a.n).slice(0, 5).map(({peerId, n}) => ({peerId, n}))
  };
}
export function fmtSpent(sec: number): string {
  const m = Math.round(sec / 60);
  if(m < 1) return sec > 0 ? '1 daqiqadan kam' : '0 daqiqa';
  const h = Math.floor(m / 60), r = m % 60;
  return h ? `${h} soat${r ? ` ${r} daqiqa` : ''}` : `${m} daqiqa`;
}

// ---------------------------------------------------------------- maxfiy chatlar PIN'i
export const validPin = (pin: string) => /^\d{4,8}$/.test(pin);
const hex = (b: ArrayBuffer | Uint8Array) => Array.from(b instanceof Uint8Array ? b : new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('');
export const newSalt = () => hex(crypto.getRandomValues(new Uint8Array(16)));
/** PIN'ning o'zi saqlanmaydi: faqat PBKDF2 (tuz bilan) natijasi. */
export async function hashPin(pin: string, salt: string, iterations = 150000): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode('toza-hidden:' + salt), iterations}, key, 256);
  return hex(bits);
}
/** Ketma-ket noto'g'ri urinishlardan keyin kutish (soniya): 5 tadan keyin 30s, keyin ikki baravardan, 15 daqiqagacha. */
export const pinDelay = (fails: number) => fails < 5 ? 0 : Math.min(900, 30 * 2 ** (fails - 5));
