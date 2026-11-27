// Qo'ng'iroq uchun o'z TURN serveri (ixtiyoriy, Toza sozlamalari -> Aloqa -> Kengaytirilgan). Telegram'ning serverlariga qo'shimcha
// qilib beriladi: o'zingizning chet eldagi TURN serveringiz bo'lsa, qo'ng'iroq o'sha orqali ham ulanishi mumkin. Import yo'q (callInstance'dan chaqiriladi).
export type TurnConf = {url: string; user: string; pass: string};
const LS = 'toza_turn';
export const turnConf = (): TurnConf => { try { return {url: '', user: '', pass: '', ...JSON.parse(localStorage.getItem(LS) || '{}')}; } catch{ return {url: '', user: '', pass: ''}; } };
export function setTurnConf(c: TurnConf) { try { localStorage.setItem(LS, JSON.stringify(c)); } catch{ /* xotira yopiq */ } }
export const validTurnUrl = (u: string) => /^turns?:[^\s]+$/i.test(u.trim());
export function tozaIceServers(): RTCIceServer[] {
  const c = turnConf();
  if(!validTurnUrl(c.url)) return [];
  return [{urls: c.url.trim(), ...(c.user ? {username: c.user, credential: c.pass} : {})}];
}
