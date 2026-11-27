// Saqlangan faylni ko'rsatish (ko'lanka blok, o'chirilganlar ro'yxati): turiga qarab rasm, video, audio yoki yuklab olish havolasi.
import {MEDIA_LABEL} from './core';
import type {MediaKind} from './core';

const b64bytes = (x: string) => Uint8Array.from(atob(x), (c) => c.charCodeAt(0));
export const blobUrl = (parts: string[], mime: string) => URL.createObjectURL(new Blob(parts.map(b64bytes), {type: mime}));

export function mediaNode(file: {kind: MediaKind; mime: string; b64: string[]; name?: string}): HTMLElement {
  const url = blobUrl(file.b64, file.mime);
  const k = file.kind;
  if(k === 'photo' || (k === 'sticker' && !/webm/.test(file.mime))) {
    const i = document.createElement('img');
    i.src = url;
    i.style.cssText = k === 'sticker' ? 'max-width:160px;margin-top:4px;' : 'max-width:100%;border-radius:8px;margin-top:4px;';
    return i;
  }
  if(k === 'audio') {
    const a = document.createElement('audio');
    a.controls = true; a.preload = 'none'; a.src = url; a.style.cssText = 'width:100%;margin-top:4px;';
    return a;
  }
  if(k === 'file') {
    const a = document.createElement('a');
    a.href = url; a.download = file.name || 'fayl';
    a.textContent = '📎 ' + (file.name || MEDIA_LABEL.file) + ' (yuklab olish)';
    a.style.cssText = 'display:inline-block;margin-top:4px;color:var(--link-color,#4A5AE8);word-break:break-all;';
    return a;
  }
  const v = document.createElement('video');
  v.src = url;
  if(k === 'gif' || k === 'sticker') { v.autoplay = true; v.loop = true; v.muted = true; v.playsInline = true; } else { v.controls = true; v.preload = 'none'; }
  v.style.cssText = k === 'round' ? 'width:200px;height:200px;border-radius:50%;object-fit:cover;margin-top:4px;' : k === 'sticker' ? 'max-width:160px;margin-top:4px;' : 'max-width:100%;border-radius:8px;margin-top:4px;';
  return v;
}

/** Ro'yxatdagi qisqa nom: «Rasm», «Fayl «hisobot.pdf»». */
export const mediaTitle = (file: {kind: MediaKind; name?: string}) => MEDIA_LABEL[file.kind] + (file.name ? ` «${file.name}»` : '');
