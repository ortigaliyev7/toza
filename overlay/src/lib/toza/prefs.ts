// Toza sozlamalari (asosiy oyna, localStorage): ko'rinmas rejim, bir martalik media, kalit so'zlar, yozuv.
import rootScope from '@lib/rootScope';
import type {TozaFlags} from './flags';
import {parseKeywords} from './tools-core';
import {isStrict} from './play';

const LS_FLAGS = 'toza_ghost_mode', LS_ONCE = 'toza_save_once', LS_KW = 'toza_keywords', LS_KW_ON = 'toza_keywords_on';
const read = <T>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch{ return d; } };
const write = (k: string, v: any) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch{ /* xotira yopiq */ } };

export const DEFAULT_FLAGS: TozaFlags = {noRead: false, noTyping: false, noOnline: false, noStoryView: false};
// Qoidalar rejimida (Telegram API shartlari 1.4) ko'rinmas rejim doim o'chiq: Telegram'ga hamma holatlar oddiy yuboriladi.
export const getFlags = (): TozaFlags => (isStrict() ? {...DEFAULT_FLAGS} : {...DEFAULT_FLAGS, ...read<Partial<TozaFlags>>(LS_FLAGS, {})});
export const anyGhost = () => Object.values(getFlags()).some(Boolean);

/** Ko'rinmas rejimni tweb ishchisiga yuboradi (Telegram'ga ketadigan so'rovlar o'sha yerda). Ishchi qayta ishga tushsa ham qayta chaqiriladi. */
export async function applyFlags() {
  try { await (rootScope as any).managers.appUsersManager.setTozaFlags(getFlags()); } catch{ /* ishchi hali tayyor emas */ }
}
export async function setFlags(p: Partial<TozaFlags>) {
  const next = {...getFlags(), ...p};
  write(LS_FLAGS, next);
  await applyFlags();
  // onlayn ko'rinishni qaytarganda darrov «onlayn» bo'lamiz
  if(p.noOnline === false && !document.hidden) { try { await (rootScope as any).managers.appUsersManager.updateMyOnlineStatus(false); } catch{ /* tarmoq */ } }
}

/** Bir martalik media: qoidalar rejimida saqlanmaydi (shartlar 1.4: o'zi yo'qoladigan kontentni ushlab qolish taqiqlangan). */
export const saveOnceOn = () => !isStrict() && read<boolean>(LS_ONCE, false) === true;
export const setSaveOnce = (on: boolean) => write(LS_ONCE, on);

export const keywordsRaw = () => read<string>(LS_KW, '');
export const keywords = () => parseKeywords(keywordsRaw());
export const setKeywords = (raw: string) => write(LS_KW, String(raw).slice(0, 2000));
export const keywordsOn = () => read<boolean>(LS_KW_ON, false) === true;
export const setKeywordsOn = (on: boolean) => write(LS_KW_ON, on);
