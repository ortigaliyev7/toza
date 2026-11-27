// O'chirilgan xabarlarni chat tarixining O'Z JOYIGA qaytaradi (saqlangan nusxadan): bubblelar orasida «ko'lanka» blok.
// tweb DOM: `.bubbles-inner > .bubbles-date-group > .bubbles-group > .bubble[data-mid][data-peer-id]`. Ko'lanka guruhlar ORASIGA qo'yiladi
// (guruh ichiga emas), shuning uchun tweb'ning guruhlash/avatar/animatsiya mantiqiga tegmaydi; `.bubble` klassi yo'q — tweb uni o'z ro'yxatlariga olmaydi.
import type {ArchivedMessage, MediaKind} from './core';
import {mediaNode} from './media-view';

export const GHOST_ATTR = 'data-toza-ghost';

export type GhostDeps = {
  records: () => Promise<ArchivedMessage[]>;
  voiceOf: (peerId: string, mid: number) => Promise<{mime: string; dur: number; b64: string} | undefined>;
  mediaOf: (peerId: string, mid: number) => Promise<{kind: MediaKind; mime: string; dur: number; b64: string[]; name?: string} | undefined>;
  enabled: (peerId: string) => boolean;
};

const bubbleList = (container: Element) => Array.from(container.querySelectorAll<HTMLElement>('.bubbles-date-group .bubble[data-mid]:not(.is-date)'));
const midOf = (b: HTMLElement) => Number(b.dataset.mid);

/** Bu konteyner qaysi chatniki (birinchi bubbledan). */
export const containerPeer = (container: Element): string => bubbleList(container).find((b) => b.dataset.peerId)?.dataset.peerId || '';

/** Ko'lankani mid tartibida joylaydi: o'zidan kichik mid'li oxirgi bubble guruhidan KEYIN. Joyi topilmasa (hali yuklanmagan eski tarix) — false. */
export function placeGhost(container: Element, ghost: HTMLElement, mid: number): boolean {
  const list = bubbleList(container);
  let prev: HTMLElement | null = null;
  for(const b of list) { const m = midOf(b); if(m > 0 && m < mid && (!prev || m > midOf(prev))) prev = b; }
  if(!prev) return false;
  const group = prev.closest('.bubbles-group');
  if(!group?.parentElement) return false;
  // oldin shu joyga qo'yilgan boshqa ko'lankalardan keyin (mid tartibida)
  let anchor: Element = group;
  while(anchor.nextElementSibling?.hasAttribute(GHOST_ATTR) && Number((anchor.nextElementSibling as HTMLElement).dataset.tozaMid) < mid) anchor = anchor.nextElementSibling;
  anchor.after(ghost);
  return true;
}

const b64bytes = (x: string) => Uint8Array.from(atob(x), (c) => c.charCodeAt(0));
const fmtTime = (sec: number) => new Date(sec * 1000).toLocaleString([], {hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit'});

async function buildGhost(rec: ArchivedMessage, deps: GhostDeps): Promise<HTMLElement> {
  const el = document.createElement('div');
  el.setAttribute(GHOST_ATTR, `${rec.peerId}:${rec.mid}`);
  el.dataset.tozaMid = String(rec.mid);
  el.setAttribute('style', 'margin:6px 12px;padding:8px 12px;max-width:min(80%,420px);border-radius:12px;border-left:4px solid #e8860c;background:var(--surface-color,rgba(255,255,255,.92));color:var(--primary-text-color,#000);box-shadow:0 1px 3px rgba(0,0,0,.12);font-size:14px;line-height:1.35;opacity:.92;word-break:break-word;');
  const head = document.createElement('div');
  head.setAttribute('style', 'font-size:11px;opacity:.65;margin-bottom:3px;');
  head.textContent = `O'chirilgan xabar · ${fmtTime(rec.date)}${rec.deleted ? ' · o\'chirildi ' + fmtTime(rec.deleted) : ''}`;
  el.append(head);
  const voice = await deps.voiceOf(rec.peerId, rec.mid), file = await deps.mediaOf(rec.peerId, rec.mid);
  if(rec.text) { const t = document.createElement('div'); t.setAttribute('style', 'white-space:pre-wrap;'); t.textContent = rec.text; el.append(t); }
  else if(!voice && !file && rec.kind) { const t = document.createElement('div'); t.setAttribute('style', 'font-style:italic;opacity:.75;'); t.textContent = `[${rec.kind.replace('messageMedia', '')}]`; el.append(t); }
  for(const e of rec.edits || []) { const t = document.createElement('div'); t.setAttribute('style', 'font-size:12px;opacity:.65;margin-top:2px;'); t.textContent = 'Oldingi: ' + e.text; el.append(t); }
  if(voice) { const a = document.createElement('audio'); a.controls = true; a.preload = 'none'; a.style.cssText = 'width:100%;margin-top:4px;'; a.src = URL.createObjectURL(new Blob([b64bytes(voice.b64)], {type: voice.mime})); el.append(a); }
  if(file) el.append(mediaNode(file));
  return el;
}

/** Ochiq chatdagi (konteynerdagi) o'chirilgan xabarlarni joyiga qo'yadi. Xatolik tweb'ga zarar qilmaydi (hammasi try/catch). */
export async function injectGhosts(deps: GhostDeps, root: ParentNode = document): Promise<number> {
  let placed = 0;
  try {
    const containers = Array.from(root.querySelectorAll('.bubbles-inner'));
    if(!containers.length) return 0;
    const all = await deps.records();
    for(const c of containers) {
      const peer = containerPeer(c);
      if(!peer || Number(peer) <= 0 || !deps.enabled(peer)) continue;
      const have = new Set(Array.from(c.querySelectorAll(`[${GHOST_ATTR}]`)).map((x) => x.getAttribute(GHOST_ATTR)));
      const live = new Set(bubbleList(c).map((b) => b.dataset.mid));
      const dead = all.filter((m) => m.peerId === peer && m.deleted && !m.out && !m.k.startsWith('v:') && !m.k.startsWith('m:') && !live.has(String(m.mid)) && !have.has(`${m.peerId}:${m.mid}`)).sort((a, b) => a.mid - b.mid);
      for(const rec of dead) {
        const el = await buildGhost(rec, deps);
        if(placeGhost(c, el, rec.mid)) placed++;
        else el.querySelectorAll('audio,video,img,a[download]').forEach((m: any) => URL.revokeObjectURL(m.src || m.href));
      }
    }
  } catch{ /* ko'lanka muhim emas: chat buzilmasin */ }
  return placed;
}
