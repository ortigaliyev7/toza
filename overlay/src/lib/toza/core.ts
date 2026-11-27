/**
 * Toza zaxirasi — YADRO (tweb'ga bog'liq emas, import yo'q; Node'da ham sinaladi).
 *
 * Tiklash kodi (128 bit) -> HKDF -> uchta mustaqil qiymat:
 *   enc   : AES-GCM kaliti (brauzerda qoladi, serverga HECH QACHON yuborilmaydi)
 *   id    : server to'plami nomi
 *   auth  : kirish tokeni (server faqat sha256(token) ni saqlaydi)
 * Xabarlar brauzerda gzip + AES-GCM bilan shifrlanib bo'laklar (chunk) bilan yuklanadi. Server ularni o'qiy olmaydi.
 */

const te = new TextEncoder();
const td = new TextDecoder();
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const CODE_CHARS = 26; // 26 * 5 = 130 bit (128 bit entropiya)
const SALT = te.encode('toza-backup-v1');
const AAD = te.encode('toza-chunk-v1');

// ---------------------------------------------------------------- kod va kalitlar
export function generateRecoveryCode(): string {
  const bytes = new Uint8Array(CODE_CHARS);
  crypto.getRandomValues(bytes);
  // 32 ga bo'linadi (256 % 32 === 0) — tarafkashlik yo'q
  const raw = Array.from(bytes, (b) => B32[b % 32]).join('');
  return formatCode(raw);
}

export function formatCode(raw: string): string {
  return raw.match(/.{1,4}/g)!.join('-');
}

/** Foydalanuvchi kiritgan kodni tozalaydi (katta harf, defis/bo'sh joyni olib tashlaydi). Noto'g'ri bo'lsa null. */
export function normalizeCode(input: string): string | null {
  const s = String(input || '').toUpperCase().replace(/[\s-]/g, '');
  return s.length === CODE_CHARS && [...s].every((c) => B32.includes(c)) ? s : null;
}

function b32decode(s: string): Uint8Array {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const c of s) {
    value = (value << 5) | B32.indexOf(c);
    bits += 5;
    if(bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');

export type Keys = {id: string; token: string; key: CryptoKey};

export async function deriveKeys(code: string): Promise<Keys> {
  const norm = normalizeCode(code);
  if(!norm) throw new Error('bad_code');
  const base = await crypto.subtle.importKey('raw', b32decode(norm), 'HKDF', false, ['deriveBits', 'deriveKey']);
  const bits = (info: string) => crypto.subtle.deriveBits({name: 'HKDF', hash: 'SHA-256', salt: SALT, info: te.encode(info)}, base, 256);
  const key = await crypto.subtle.deriveKey({name: 'HKDF', hash: 'SHA-256', salt: SALT, info: te.encode('enc')}, base, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
  return {id: hex(await bits('id')), token: hex(await bits('auth')), key};
}

// ---------------------------------------------------------------- shifrlash
async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([data as BlobPart]).stream().pipeThrough(stream as any));
  return new Uint8Array(await out.arrayBuffer());
}

export async function encryptChunk(key: CryptoKey, plain: Uint8Array): Promise<Uint8Array> {
  const gz = await pipe(plain, new CompressionStream('gzip'));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({name: 'AES-GCM', iv, additionalData: AAD}, key, gz as BufferSource));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv, 0);
  out.set(ct, 12);
  return out;
}

export async function decryptChunk(key: CryptoKey, blob: Uint8Array): Promise<Uint8Array> {
  if(blob.length < 13) throw new Error('bad_chunk');
  const gz = new Uint8Array(await crypto.subtle.decrypt({name: 'AES-GCM', iv: blob.slice(0, 12), additionalData: AAD}, key, blob.slice(12) as BufferSource));
  return pipe(gz, new DecompressionStream('gzip'));
}

// ---------------------------------------------------------------- arxiv
/** Saqlanadigan fayl turlari: rasm, dumaloq video, video, GIF (mp4), musiqa, hujjat, stiker (webp/webm). */
export type MediaKind = 'photo' | 'round' | 'video' | 'gif' | 'audio' | 'file' | 'sticker';
export const MEDIA_LABEL: Record<MediaKind | 'voice', string> = {photo: 'Rasm', round: 'Dumaloq video', video: 'Video', gif: 'GIF', audio: 'Musiqa', file: 'Fayl', sticker: 'Stiker', voice: 'Ovozli xabar'};

/** Hujjat turi -> saqlanadigan fayl turi. Animatsiyali (.tgs) stiker saqlanmaydi: uni brauzer o'zi ko'rsata olmaydi. */
export function docKind(doc: any): MediaKind | 'voice' | null {
  if(!doc) return null;
  switch(doc.type) {
    case 'voice': return 'voice';
    case 'round': return 'round';
    case 'video': return 'video';
    case 'gif': return 'gif';
    case 'audio': return 'audio';
    case 'sticker': return doc.sticker === 2 ? null : 'sticker';
    case 'photo': return 'photo';
    default: return 'file';
  }
}

export type ArchivedMessage = {
  k: string;                       // `${peerId}:${mid}`
  peerId: string;
  mid: number;
  date: number;                    // xabar sanasi (sekund)
  from?: string;
  out?: boolean;
  text: string;                    // eng so'nggi ma'lum matn
  kind?: string;                   // media turi (matnsiz xabar uchun)
  edits?: {t: number; text: string}[]; // oldingi versiyalar
  deleted?: number;                // o'chirilgan vaqt (sekund)
  once?: true;                     // bir martalik (ko'rilgach yo'qoladigan) rasm/video edi
  voice?: {mime: string; dur: number; b64: string}; // ovozli xabar (faqat `v:` yozuvlarida): kichik, bir marta yuklanadi
  media?: {kind: MediaKind; mime: string; dur: number; i: number; n: number; b64: string; name?: string}; // fayl bo'lagi (faqat `m:` yozuvlarida); `name` — hujjat nomi
  u: number;                       // oxirgi o'zgarish vaqti (ms) — birlashtirishda yangisi yutadi
};

export function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for(let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export const keyOf = (peerId: string | number, mid: number) => `${peerId}:${mid}`;
/** Ovozli xabar alohida yozuvda (`v:<peer>:<mid>`): xabar keyin o'chirilsa/tahrirlansa ovoz qayta yuklanmaydi (hajm oshmaydi). */
export const voiceKey = (peerId: string | number, mid: number) => `v:${keyOf(peerId, mid)}`;
export const isVoiceKey = (k: string) => k.startsWith('v:');
/** Rasm va dumaloq video: bo'laklarga bo'lingan alohida yozuvlar `m:<peer>:<mid>:<i>` (bir marta yuklanadi). */
export const mediaKey = (peerId: string | number, mid: number, i: number) => `m:${keyOf(peerId, mid)}:${i}`;
export const isMediaKey = (k: string) => k.startsWith('m:');
/** Matn emas, fayl yozuvi (ovoz/rasm/video): xabarlar ro'yxati va hisoblarda alohida. */
export const isBlobKey = (k: string) => isVoiceKey(k) || isMediaKey(k);
export const MEDIA_PART_BYTES = 700_000;           // bitta yozuvdagi xom bayt (base64 ~933 KB: bitta bo'lakka sig'adi)
export const MEDIA_MAX_BYTES: Record<MediaKind, number> = {photo: 5_000_000, round: 15_000_000, video: 25_000_000, gif: 8_000_000, audio: 15_000_000, file: 10_000_000, sticker: 1_000_000};
export const VOICE_MAX_BYTES = 1_000_000;         // bundan katta ovoz saqlanmaydi (taxminan 2-3 daqiqa)

export interface ArchiveStore {
  get(k: string): Promise<ArchivedMessage | undefined>;
  put(m: ArchivedMessage, dirty: boolean): Promise<void>;
  dirty(limit: number): Promise<ArchivedMessage[]>;
  clearDirty(items: {k: string; u: number}[]): Promise<void>;
  all(): Promise<ArchivedMessage[]>;
  clear(): Promise<void>;
  remove(keys: string[]): Promise<void>;
  markAllDirty(): Promise<void>;
}

export class MemoryStore implements ArchiveStore {
  private m = new Map<string, {rec: ArchivedMessage; d: boolean}>();
  async get(k: string) { return this.m.get(k)?.rec; }
  async put(rec: ArchivedMessage, dirty: boolean) { this.m.set(rec.k, {rec: structuredClone(rec), d: dirty}); }
  async dirty(limit: number) { return [...this.m.values()].filter((x) => x.d).slice(0, limit).map((x) => structuredClone(x.rec)); }
  async clearDirty(items: {k: string; u: number}[]) { for(const {k, u} of items) { const x = this.m.get(k); if(x && x.rec.u === u) x.d = false; } }
  async all() { return [...this.m.values()].map((x) => structuredClone(x.rec)); }
  async clear() { this.m.clear(); }
  async remove(keys: string[]) { for(const k of keys) this.m.delete(k); }
  async markAllDirty() { for(const x of this.m.values()) x.d = true; }
}

/** Ikki nusxani birlashtiradi: o'chirilgan belgisi saqlanadi, versiyalar birlashadi, matn — yangisidan. */
export function mergeMessage(a: ArchivedMessage, b: ArchivedMessage): ArchivedMessage {
  const [old, cur] = a.u <= b.u ? [a, b] : [b, a];
  const seen = new Set<string>();
  const edits = [...(old.edits || []), ...(cur.edits || [])].filter((e) => { const id = e.t + '|' + e.text; return seen.has(id) ? false : (seen.add(id), true); }).sort((x, y) => x.t - y.t);
  const deleted = [a.deleted, b.deleted].filter(Boolean).sort((x, y) => x! - y!)[0];
  return {...cur, edits: edits.length ? edits : undefined, deleted, kind: cur.kind || old.kind, ...(a.once || b.once ? {once: true as const} : {})};
}

export type Incoming = {peerId: string | number; mid: number; date: number; from?: string | number; out?: boolean; text: string; kind?: string; once?: boolean};

/** Mahalliy arxiv mantiqi (rootScope'ga bog'liq emas): yangi xabar, tahrir, o'chirish. */
export class Archive {
  store: ArchiveStore;
  private now: () => number;

  constructor(store: ArchiveStore, now: () => number = () => Date.now()) {
    this.store = store;
    this.now = now;
  }

  async capture(m: Incoming): Promise<'new' | 'edited' | 'same'> {
    const k = keyOf(m.peerId, m.mid);
    const prev = await this.store.get(k);
    const base: ArchivedMessage = {k, peerId: String(m.peerId), mid: m.mid, date: m.date, from: m.from !== undefined ? String(m.from) : undefined, out: m.out, text: m.text, kind: m.kind || prev?.kind, u: this.now()};
    if(m.once || prev?.once) base.once = true;                                        // ko'rilgach media yo'qoladi: belgi saqlanib qoladi
    if(!prev) {
      await this.store.put(base, true);
      return 'new';
    }
    if(prev.text === m.text) return 'same';
    await this.store.put({...prev, ...base, edits: [...(prev.edits || []), {t: Math.floor(this.now() / 1000), text: prev.text}], deleted: prev.deleted}, true);
    return 'edited';
  }

  /** Ovozli xabarni saqlaydi (bir marta). Katta bo'lsa yoki allaqachon bor bo'lsa — saqlamaydi. Qaytaradi: saqlandimi. */
  async captureVoice(m: {peerId: string | number; mid: number; date: number; from?: string | number; out?: boolean}, voice: {mime: string; dur: number; b64: string}): Promise<boolean> {
    if(!voice.b64 || Math.floor(voice.b64.length * 3 / 4) > VOICE_MAX_BYTES) return false;
    const k = voiceKey(m.peerId, m.mid);
    if(await this.store.get(k)) return false;
    await this.store.put({k, peerId: String(m.peerId), mid: m.mid, date: m.date, from: m.from !== undefined ? String(m.from) : undefined, out: m.out, text: '', kind: 'voice-blob', voice, u: this.now()}, true);
    return true;
  }

  /** Faylni (rasm, video, GIF, musiqa, hujjat, stiker) bo'laklab saqlaydi (bir marta). Qaytaradi: saqlandimi (katta bo'lsa yoki bor bo'lsa — yo'q). */
  async captureMedia(m: {peerId: string | number; mid: number; date: number; from?: string | number; out?: boolean}, kind: MediaKind, mime: string, dur: number, bytes: Uint8Array, name?: string): Promise<boolean> {
    if(!bytes.length || !MEDIA_MAX_BYTES[kind] || bytes.length > MEDIA_MAX_BYTES[kind]) return false;
    const fname = name ? String(name).slice(0, 120) : undefined;
    if(await this.store.get(mediaKey(m.peerId, m.mid, 0))) return false;
    const n = Math.ceil(bytes.length / MEDIA_PART_BYTES);
    for(let i = 0; i < n; i++) {
      const part = bytes.subarray(i * MEDIA_PART_BYTES, (i + 1) * MEDIA_PART_BYTES);
      await this.store.put({k: mediaKey(m.peerId, m.mid, i), peerId: String(m.peerId), mid: m.mid, date: m.date, from: m.from !== undefined ? String(m.from) : undefined, out: m.out, text: '', kind: 'media-blob', media: {kind, mime, dur, i, n, b64: toBase64(part), ...(fname && i === 0 ? {name: fname} : {})}, u: this.now()}, true);
    }
    return true;
  }

  /** Saqlangan fayl: hamma bo'laklar bo'lsa birlashtirib qaytaradi, aks holda undefined. */
  async mediaOf(peerId: string | number, mid: number): Promise<{kind: MediaKind; mime: string; dur: number; b64: string[]; name?: string} | undefined> {
    const first = (await this.store.get(mediaKey(peerId, mid, 0)))?.media;
    if(!first) return undefined;
    const b64: string[] = [first.b64];
    for(let i = 1; i < first.n; i++) {
      const part = (await this.store.get(mediaKey(peerId, mid, i)))?.media;
      if(!part) return undefined;
      b64.push(part.b64);
    }
    return {kind: first.kind, mime: first.mime, dur: first.dur, b64, ...(first.name ? {name: first.name} : {})};
  }

  async voiceOf(peerId: string | number, mid: number) {
    return (await this.store.get(voiceKey(peerId, mid)))?.voice;
  }

  /** Telegram'da o'chirildi: bizda nusxasi bo'lsa — «o'chirilgan» deb belgilanadi (matn saqlanadi). Qaytaradi: belgilanganlar soni. */
  async deleted(peerId: string | number, mids: Iterable<number>): Promise<number> {
    let n = 0;
    const ts = Math.floor(this.now() / 1000);
    for(const mid of mids) {
      const rec = await this.store.get(keyOf(peerId, mid));
      if(rec && !rec.deleted) {
        await this.store.put({...rec, deleted: ts, u: this.now()}, true);
        n++;
      }
    }
    return n;
  }

  /** Bitta chatning hamma saqlangan nusxasini (matn, ovoz, rasm, video) mahalliy arxivdan olib tashlaydi. Qaytaradi: o'chirilgan yozuvlar soni. */
  async purgePeer(peerId: string | number): Promise<number> {
    const keys = (await this.store.all()).filter((m) => m.peerId === String(peerId)).map((m) => m.k);
    await this.store.remove(keys);
    return keys.length;
  }

  /** Saqlangan bir martalik media xabarlari (yangisi birinchi). */
  async onceMessages(): Promise<ArchivedMessage[]> {
    return (await this.store.all()).filter((x) => x.once && !isBlobKey(x.k)).sort((x, y) => y.date - x.date);
  }

  async deletedMessages(): Promise<ArchivedMessage[]> {
    return (await this.store.all()).filter((x) => x.deleted && !isBlobKey(x.k)).sort((x, y) => y.deleted! - x.deleted!);
  }

  /** Tiklangan nusxalarni mahalliy arxivga qo'shadi (birlashtirib). Qaytaradi: yangi yoki o'zgargan yozuvlar soni. */
  async importAll(list: ArchivedMessage[]): Promise<number> {
    let n = 0;
    for(const rec of list) {
      const prev = await this.store.get(rec.k);
      const next = prev ? mergeMessage(prev, rec) : rec;
      if(!prev || JSON.stringify(next) !== JSON.stringify(prev)) {
        await this.store.put(next, false);
        n++;
      }
    }
    return n;
  }
}

// ---------------------------------------------------------------- sinxronlash
export class TozaApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string) {
    super(`${status} ${code}`);
    this.status = status;
    this.code = code;
  }
}

export type SyncStatus = {used: number; quota: number; chunks: number; linked: boolean; paid: boolean; updated: number};

export class Sync {
  private nextSeq: number | null = null;
  private o: {baseUrl: string; keys: Keys; store: ArchiveStore; fetch?: typeof fetch; maxBatchBytes?: number; mediaAllowed?: () => boolean};
  /** Server «faqat obunada» (402) deb rad etdi: shu sessiyada fayllar yuborilmaydi (xabar matnlari yuboriladi). */
  mediaBlocked = false;

  constructor(o: {baseUrl: string; keys: Keys; store: ArchiveStore; fetch?: typeof fetch; maxBatchBytes?: number; mediaAllowed?: () => boolean}) {
    this.o = o;
  }

  private get f() { return this.o.fetch || fetch.bind(globalThis); }
  private url(p: string) { return this.o.baseUrl.replace(/\/+$/, '') + p; }
  private headers(extra: Record<string, string> = {}) { return {'X-TB-Id': this.o.keys.id, 'X-TB-Token': this.o.keys.token, ...extra}; }

  private async call(method: string, path: string, body?: BodyInit, extra: Record<string, string> = {}) {
    const r = await this.f(this.url(path), {method, headers: this.headers(extra), body});
    if(!r.ok) {
      let code = 'error';
      try { code = (await r.clone().json()).error || code; } catch{ /* JSON emas */ }
      throw new TozaApiError(r.status, code);
    }
    return r;
  }

  /** Yangi zaxira to'plamini yaratadi (yoki mavjudini davom ettiradi). */
  async init(): Promise<'created' | 'exists'> {
    return (await (await this.call('POST', '/tb/init')).json()).status;
  }

  async status(): Promise<SyncStatus> {
    const j = await (await this.call('GET', '/tb/list')).json();
    this.nextSeq = j.chunks.length ? Math.max(...j.chunks.map((c: any) => c.seq)) + 1 : 0;
    return {used: j.used, quota: j.quota, chunks: j.chunks.length, linked: j.linked, paid: !!j.paid, updated: j.updated};
  }

  /** O'zgargan yozuvlarni shifrlab yuklaydi. Qaytaradi: yuklangan bo'laklar soni. */
  async flush(): Promise<number> {
    const max = this.o.maxBatchBytes || 1_500_000;
    let chunks = 0;
    for(;;) {
      const mediaOk = () => !this.mediaBlocked && (!this.o.mediaAllowed || this.o.mediaAllowed());
      // avval matn, keyin fayllar (ular alohida bo'laklarda: server fayllarni «media» deb ajratadi)
      const all = await this.o.store.dirty(2000);
      const text = all.filter((m) => !isBlobKey(m.k));
      const pending = text.length ? text : mediaOk() ? all.filter((m) => isBlobKey(m.k)) : [];
      if(!pending.length) return chunks;
      const media = !text.length;
      const batch: ArchivedMessage[] = [];
      let size = 0;
      for(const rec of pending) {
        const len = JSON.stringify(rec).length;
        if(batch.length && size + len > max) break;
        batch.push(rec);
        size += len;
      }
      if(this.nextSeq === null) await this.status();
      const body = await encryptChunk(this.o.keys.key, te.encode(JSON.stringify({v: 1, msgs: batch})));
      try {
        await this.call('PUT', `/tb/chunk/${this.nextSeq}`, body as BodyInit, {'Content-Type': 'application/octet-stream', 'X-TB-Kind': media ? 'media' : 'text'});
      } catch(e) {
        if(media && e instanceof TozaApiError && e.code === 'paid_only') { this.mediaBlocked = true; continue; }
        throw e;
      }
      this.nextSeq!++;
      await this.o.store.clearDirty(batch.map((m) => ({k: m.k, u: m.u})));
      chunks++;
    }
  }

  /** Serverdagi hamma bo'laklarni yuklab, shifrini ochib qaytaradi. */
  async fetchAll(): Promise<ArchivedMessage[]> {
    const j = await (await this.call('GET', '/tb/list')).json();
    const out: ArchivedMessage[] = [];
    for(const c of j.chunks) {
      const buf = new Uint8Array(await (await this.call('GET', `/tb/chunk/${c.seq}`)).arrayBuffer());
      const data = JSON.parse(td.decode(await decryptChunk(this.o.keys.key, buf)));
      if(data?.v !== 1 || !Array.isArray(data.msgs)) throw new Error('bad_chunk');
      out.push(...data.msgs);
    }
    return out;
  }

  async link(code: string) {
    await this.call('POST', '/tb/link', JSON.stringify({code}), {'Content-Type': 'application/json'});
  }

  /** Sharpa bo'limlari (Bozor, Profil) uchun qurilma tokeni: to'plam Sharpa akkauntiga ulangan bo'lishi shart (`not_linked`). */
  async device(): Promise<{k: string; url: string}> {
    return (await this.call('POST', '/tb/device')).json();
  }

  /** Serverdagi hamma bo'laklarni tozalaydi (to'plam va obuna ulanishi qoladi): arxivni qayta yozishdan oldin. */
  async reset() {
    await this.call('POST', '/tb/reset');
    this.nextSeq = 0;
    this.mediaBlocked = false;
  }

  async wipe() {
    await this.call('DELETE', '/tb');
    this.nextSeq = null;
  }
}

/** Serverdan tiklash: shifrni ochadi va mahalliy arxivga birlashtiradi. */
export async function restoreInto(sync: Sync, archive: Archive): Promise<{messages: number; deleted: number}> {
  const list = await sync.fetchAll();
  const changed = await archive.importAll(list);
  return {messages: changed, deleted: list.filter((m) => m.deleted).length};
}
