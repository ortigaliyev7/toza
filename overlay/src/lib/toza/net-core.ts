// Aloqa va qo'ng'iroq yordamchilarining toza mantig'i (DOM'siz): sifat darajasi, video cheklovi, ovozga o'tish qarori,
// sekin internetni aniqlash, sozlamalar zaxira fayli. Testlar: tests/net.test.mjs.

export type Tier = 'good' | 'ok' | 'weak' | 'bad';
export type Sample = {kbps?: number; loss?: number; rtt?: number};

export const TIER_LABEL: Record<Tier, string> = {good: 'A\'lo', ok: 'Yaxshi', weak: 'Zaif', bad: 'Juda zaif'};

/** Bir soniyalik o'lchovdan aloqa darajasi. kbps: chiquvchi kanal bahosi, loss: yo'qolgan paketlar %, rtt: ms.
 *  Brauzer biror qiymatni bermasa (Firefox kbps bermaydi) — qolganlari bo'yicha. */
export function tierOf(s: Sample): Tier {
  const k = s.kbps, l = s.loss ?? 0, r = s.rtt ?? 0;
  if((k !== undefined && k < 100) || l >= 15 || r >= 800) return 'bad';
  if((k !== undefined && k < 300) || l >= 6 || r >= 400) return 'weak';
  if((k !== undefined && k < 900) || l >= 2 || r >= 200) return 'ok';
  return 'good';
}

export type VideoCap = {maxBitrate: number; scaleResolutionDownBy: number; maxFramerate: number} | null;
/** Aloqa darajasiga qarab o'z videomiz cheklovi (null — cheklovsiz, Telegram'ning o'zi boshqaradi). */
export function videoCap(t: Tier): VideoCap {
  if(t === 'ok') return {maxBitrate: 600000, scaleResolutionDownBy: 1.5, maxFramerate: 24};
  if(t === 'weak') return {maxBitrate: 280000, scaleResolutionDownBy: 2, maxFramerate: 15};
  if(t === 'bad') return {maxBitrate: 120000, scaleResolutionDownBy: 3, maxFramerate: 10};
  return null;
}

/** Darajani bir zumda sakratmaslik: pasayish 3 soniya, ko'tarilish 8 soniya ketma-ket bo'lsa qabul qilinadi. */
export class TierSmoother {
  public tier: Tier = 'good';
  private cand: Tier = 'good';
  private n = 0;
  private down: number;
  private up: number;
  constructor(down = 3, up = 8) { this.down = down; this.up = up; }
  push(t: Tier): Tier {
    if(t === this.tier) { this.cand = t; this.n = 0; return this.tier; }
    if(t !== this.cand) { this.cand = t; this.n = 0; }
    this.n++;
    const rank = {good: 0, ok: 1, weak: 2, bad: 3};
    const need = rank[t] > rank[this.tier] ? this.down : this.up;
    if(this.n >= need) { this.tier = t; this.n = 0; }
    return this.tier;
  }
}

export type FallbackAction = 'toAudio' | 'backToVideo' | null;
/** Video qotsa ovozga o'tish: «juda zaif» aloqa yoki qotgan video 6 soniya davom etsa — o'z videomizni o'chiramiz.
 *  O'zimiz o'chirgan bo'lsak va aloqa 20 soniya yaxshi tursa — qaytarishni taklif qilamiz (o'zi yoqmaydi: kamera kutilmaganda yonmasin). */
export class FallbackTracker {
  public autoOff = false;
  private bad = 0;
  private good = 0;
  private badSec: number;
  private goodSec: number;
  constructor(badSec = 6, goodSec = 20) { this.badSec = badSec; this.goodSec = goodSec; }
  push(t: Tier, frozen: boolean, videoOn: boolean): FallbackAction {
    const isBad = t === 'bad' || frozen;
    this.bad = isBad ? this.bad + 1 : 0;
    this.good = (t === 'good' || t === 'ok') && !frozen ? this.good + 1 : 0;
    if(videoOn && this.bad >= this.badSec) { this.bad = 0; this.autoOff = true; return 'toAudio'; }
    if(!videoOn && this.autoOff && this.good >= this.goodSec) { this.autoOff = false; this.good = 0; return 'backToVideo'; }
    if(videoOn) this.autoOff = false;
    return null;
  }
}

/** Kelayotgan video qotganini aniqlash: dekodlangan kadrlar soni 4 soniya o'smasa. */
export class FreezeDetector {
  private last = -1;
  private still = 0;
  push(framesDecoded: number | undefined, remoteVideoOn: boolean): boolean {
    if(!remoteVideoOn || framesDecoded === undefined) { this.last = -1; this.still = 0; return false; }
    if(framesDecoded === this.last) this.still++; else this.still = 0;
    this.last = framesDecoded;
    return this.still >= 4;
  }
}

/** Brauzer «internet sekin» deyaptimi (navigator.connection). */
export function looksSlow(c: {effectiveType?: string; saveData?: boolean; downlink?: number} | undefined): boolean {
  if(!c) return false;
  if(c.saveData) return true;
  if(c.effectiveType === 'slow-2g' || c.effectiveType === '2g') return true;
  return typeof c.downlink === 'number' && c.downlink > 0 && c.downlink < 0.4;
}

// ---------------------------------------------------------------- sozlamalar zaxira fayli
/** Faylga kirmaydiganlar: zaxira kodi va obuna/qurilma tokenlari (boshqa qurilmada ishlamaydi yoki xavfli), vaqtinchalik holatlar. */
const SKIP = /^toza_(code|on|paid|biz_|sharpa|seen|gaps|build_seen|update_from|opened|player_pos|hidden_fails|lock|slow_prev|backup_at)/;
export const backupKey = (k: string) => k.startsWith('toza_') && !SKIP.test(k);

export type BackupFile = {t: 'toza-backup'; v: 1; at: number; keys?: Record<string, string>; enc?: {salt: string; iv: string; data: string}};

const b64 = (u: Uint8Array) => { let s = ''; u.forEach((x) => (s += String.fromCharCode(x))); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function passKey(pass: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: 200000}, base, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
}

export async function packBackup(keys: Record<string, string>, pass = '', now = Date.now()): Promise<BackupFile> {
  const clean: Record<string, string> = {};
  for(const k of Object.keys(keys)) if(backupKey(k) && typeof keys[k] === 'string') clean[k] = keys[k];
  if(!pass) return {t: 'toza-backup', v: 1, at: now, keys: clean};
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await crypto.subtle.encrypt({name: 'AES-GCM', iv}, await passKey(pass, salt), new TextEncoder().encode(JSON.stringify(clean))));
  return {t: 'toza-backup', v: 1, at: now, enc: {salt: b64(salt), iv: b64(iv), data: b64(data)}};
}

export class BackupError extends Error {}
/** Fayldan kalitlarni oladi. Xatolar: 'format' (Toza fayli emas), 'pass' (parol kerak yoki noto'g'ri). */
export async function unpackBackup(raw: string, pass = ''): Promise<Record<string, string>> {
  let f: BackupFile;
  try { f = JSON.parse(raw); } catch{ throw new BackupError('format'); }
  if(!f || f.t !== 'toza-backup' || f.v !== 1) throw new BackupError('format');
  let keys: Record<string, string>;
  if(f.enc) {
    if(!pass) throw new BackupError('pass');
    try {
      const plain = await crypto.subtle.decrypt({name: 'AES-GCM', iv: unb64(f.enc.iv)}, await passKey(pass, unb64(f.enc.salt)), unb64(f.enc.data));
      keys = JSON.parse(new TextDecoder().decode(plain));
    } catch{ throw new BackupError('pass'); }
  } else keys = f.keys || {};
  const out: Record<string, string> = {};
  for(const k of Object.keys(keys)) if(backupKey(k) && typeof keys[k] === 'string') out[k] = keys[k];
  return out;
}
