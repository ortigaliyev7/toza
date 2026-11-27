// Media yuklab olish markazi: bitta chatdan rasm, video, fayl, ovozli xabar va musiqalarni turi va davri bo'yicha
// tanlab, birdaniga ZIP qilib yuklab olish. Fayllar to'g'ridan-to'g'ri Telegram'dan shu qurilmaga tushadi.
// Xotira to'lib ketmasligi uchun har ~400 MB dan keyin ZIP bo'lib-bo'lib yuklanadi.
import rootScope from '@lib/rootScope';
import appDownloadManager from '@lib/appDownloadManager';
import choosePhotoSize from '@lib/appManagers/utils/photos/choosePhotoSize';
import {hotReloadGuard} from '@lib/solidjs/hotReloadGuardProvider';
import {peerTitle} from './hooks';
import {buildZip, uniqueName} from './extras-core';
import type {ZipEntry} from './extras-core';

type Kind = 'photo' | 'video' | 'file' | 'voice' | 'music' | 'round';
const KINDS: {k: Kind; label: string; filter: string; dir: string}[] = [
  {k: 'photo', label: 'Rasmlar', filter: 'inputMessagesFilterPhotos', dir: 'Rasmlar'},
  {k: 'video', label: 'Videolar', filter: 'inputMessagesFilterVideo', dir: 'Videolar'},
  {k: 'file', label: 'Fayllar', filter: 'inputMessagesFilterDocument', dir: 'Fayllar'},
  {k: 'voice', label: 'Ovozli xabarlar', filter: 'inputMessagesFilterVoice', dir: 'Ovozli'},
  {k: 'round', label: 'Dumaloq videolar', filter: 'inputMessagesFilterRoundVideo', dir: 'Dumaloq'},
  {k: 'music', label: 'Musiqa', filter: 'inputMessagesFilterMusic', dir: 'Musiqa'}
];
const PART_BYTES = 400 * 1048576, MAX_FILE = 1536 * 1048576, PAGE = 50;
type Item = {kind: Kind; mid: number; date: number; size: number; media: any; isPhoto: boolean; name: string};

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, any> = {}, ...kids: (Node | string)[]) => {
  const el = document.createElement(tag);
  const {style, ...rest} = props;
  Object.assign(el, rest);
  if(style) el.setAttribute('style', style);
  kids.forEach((k) => el.append(k));
  return el;
};
const fmtSize = (n: number) => n >= 1073741824 ? (n / 1073741824).toFixed(1) + ' GB' : n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.ceil(n / 1024)) + ' KB';
const p2 = (n: number) => String(n).padStart(2, '0');
const stamp = (sec: number) => { const d = new Date(sec * 1000); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}_${p2(d.getHours())}-${p2(d.getMinutes())}`; };
const EXT: Record<string, string> = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
  'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/flac': 'flac', 'application/pdf': 'pdf', 'application/zip': 'zip'};

function itemOf(kind: Kind, m: any): Item | null {
  const media = m?.media;
  if(media?._ === 'messageMediaPhoto' && media.photo?._ === 'photo') {
    const size = choosePhotoSize(media.photo, 2560, 2560) as any;
    return {kind, mid: m.mid, date: m.date, size: size?.size || 0, media: media.photo, isPhoto: true, name: `${stamp(m.date)}_${m.mid}.jpg`};
  }
  const doc = media?._ === 'messageMediaDocument' ? media.document : undefined;
  if(doc?._ !== 'document') return null;
  const fname = doc.file_name || (doc.attributes || []).find((a: any) => a._ === 'documentAttributeFilename')?.file_name;
  const ext = EXT[doc.mime_type] || (fname?.includes('.') ? fname.split('.').pop() : '') || 'bin';
  const name = kind === 'file' && fname ? fname : kind === 'music' && fname ? fname : `${stamp(m.date)}_${m.mid}.${ext}`;
  return {kind, mid: m.mid, date: m.date, size: +doc.size || 0, media: doc, isPhoto: false, name};
}

async function collect(peerId: number, kinds: Kind[], minDate: number, max: number, onProgress: (n: number) => void, stop: () => boolean): Promise<Item[]> {
  const mgr = (rootScope as any).managers;
  const out: Item[] = [];
  for(const k of KINDS.filter((x) => kinds.includes(x.k))) {
    let offsetId = 0, got = 0;
    for(let page = 0; page < 200 && got < max && !stop(); page++) {
      const r = await mgr.appMessagesManager.getHistory({peerId, inputFilter: {_: k.filter}, offsetId, offsetPeerId: offsetId ? peerId : undefined, limit: PAGE});
      let msgs: any[] = r?.messages || [];
      if(!msgs.length && r?.history?.length) msgs = await Promise.all(r.history.map((mid: number) => mgr.appMessagesManager.getMessageByPeer(peerId, mid).catch((): any => undefined)));
      msgs = msgs.filter(Boolean);
      if(!msgs.length) break;
      let old = false;
      for(const m of msgs) {
        if(minDate && m.date < minDate) { old = true; continue; }
        const it = itemOf(k.k, m);
        if(it && got < max) { out.push(it); got++; }
      }
      onProgress(out.length);
      const last = msgs[msgs.length - 1];
      if(old || r?.isEnd?.top || msgs.length < PAGE || !last?.mid || last.mid === offsetId) break;
      offsetId = last.mid;
    }
  }
  return out;
}

function saveZip(parts: Uint8Array[], name: string) {
  const a = h('a', {href: URL.createObjectURL(new Blob(parts as BlobPart[], {type: 'application/zip'})), download: name}) as HTMLAnchorElement;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}

/** Toza sozlamalari → «Media yuklab olish» oynasi. */
export function mediaCenterView(note: (t: string, color?: string) => HTMLElement): HTMLElement {
  const box = h('div');
  let peer: {id: number; name: string} | null = null;
  const chosen = new Set<Kind>(['photo', 'video']);
  let period = 0, max = 200, busy = false, cancel = false;

  // --- chat tanlash
  const peerSec = h('div', {className: 'tz-sec'});
  const q = h('input', {placeholder: 'Chat nomini yozing', style: 'width:100%;box-sizing:border-box'}) as HTMLInputElement;
  const found = h('div');
  let all: {id: number; name: string}[] | null = null;
  const loadAll = async() => {
    if(all) return all;
    const ds: any[] = await (rootScope as any).managers.dialogsStorage.getCachedDialogs(true).catch((): any[] => []) || [];
    const ids = [...new Set(ds.map((d) => Number(d?.peerId)).filter(Boolean))].slice(0, 600);
    all = await Promise.all(ids.map(async(id) => ({id, name: await peerTitle(String(id))})));
    return all;
  };
  const pickPeer = (p: {id: number; name: string}) => { peer = p; paintPeer(); result.replaceChildren(); };
  const paintPeer = () => {
    peerSec.replaceChildren(h('b', {}, 'Chat'));
    if(peer) {
      peerSec.append(h('div', {className: 'tz-row'}, h('div', {className: 'tz-tx'}, peer.name), h('button', {type: 'button', onclick: () => { peer = null; paintPeer(); }}, 'Boshqa chat')));
      return;
    }
    const cur = Number((hotReloadGuard as any).appImManager?.chat?.peerId) || 0;
    if(cur) peerSec.append(h('button', {type: 'button', className: 'tz-main', style: 'width:100%;margin-bottom:8px', onclick: async() => pickPeer({id: cur, name: await peerTitle(String(cur))})}, 'Hozir ochiq chat'));
    peerSec.append(q, found);
  };
  const search = async() => {
    const s = q.value.trim().toLocaleLowerCase();
    if(!s) { found.replaceChildren(); return; }
    const list = (await loadAll()).filter((c) => c.name.toLocaleLowerCase().includes(s)).slice(0, 15);
    found.replaceChildren(...(list.length ? list.map((c) => h('div', {className: 'tz-row tz-click', onclick: () => pickPeer(c)}, h('div', {className: 'tz-tx'}, c.name))) : [h('div', {className: 'tz-hint'}, 'Topilmadi.')]));
  };
  q.oninput = () => { clearTimeout((q as any).t); (q as any).t = setTimeout(search, 200); };

  // --- turi, davri, soni
  const chip = (label: string, on: () => boolean, toggle: () => void, group: HTMLElement) => {
    const b = h('button', {type: 'button'}, label) as HTMLButtonElement;
    const paint = () => { b.className = on() ? 'tz-main' : ''; };
    b.onclick = () => { toggle(); group.querySelectorAll('button').forEach((x: any) => x.tzPaint?.()); result.replaceChildren(); };
    (b as any).tzPaint = paint; paint();
    return b;
  };
  const wrapRow = () => h('div', {style: 'display:flex;gap:6px;flex-wrap:wrap'});
  const kindsRow = wrapRow();
  KINDS.forEach((k) => kindsRow.append(chip(k.label, () => chosen.has(k.k), () => { chosen.has(k.k) ? chosen.delete(k.k) : chosen.add(k.k); }, kindsRow)));
  const periodRow = wrapRow();
  ([[0, 'Hammasi'], [7, '7 kun'], [30, '30 kun'], [365, '1 yil']] as [number, string][]).forEach(([d, l]) => periodRow.append(chip(l, () => period === d, () => { period = d; }, periodRow)));
  const maxRow = wrapRow();
  ([[50, '50 ta'], [200, '200 ta'], [1000, '1000 ta']] as [number, string][]).forEach(([n, l]) => maxRow.append(chip(l, () => max === n, () => { max = n; }, maxRow)));

  const result = h('div');
  const status = h('div', {className: 'tz-hint'});
  const bar = h('div', {style: 'height:6px;border-radius:3px;background:rgba(127,127,127,.25);overflow:hidden;margin:8px 0;display:none'}, h('div', {style: 'height:100%;width:0;background:var(--primary-color,#3390ec);transition:width .2s'}));
  const setBar = (f: number) => { bar.style.display = 'block'; (bar.firstChild as HTMLElement).style.width = `${Math.round(f * 100)}%`; };

  const find = async() => {
    if(busy) return;
    if(!peer) { result.replaceChildren(note('Avval chatni tanlang.', '#d33')); return; }
    if(!chosen.size) { result.replaceChildren(note('Kamida bitta turni tanlang.', '#d33')); return; }
    busy = true; cancel = false;
    result.replaceChildren(status, h('button', {type: 'button', onclick: () => { cancel = true; }}, 'To\'xtatish'));
    status.textContent = 'Qidirilmoqda…';
    try {
      const minDate = period ? Math.floor(Date.now() / 1000) - period * 86400 : 0;
      const items = await collect(peer.id, [...chosen], minDate, max, (n) => { status.textContent = `Qidirilmoqda… ${n} ta topildi`; }, () => cancel);
      busy = false;
      if(!items.length) { result.replaceChildren(note('Bu chatda tanlangan turdagi media topilmadi.')); return; }
      const total = items.reduce((s, x) => s + x.size, 0);
      const by = KINDS.map((k) => [k.label, items.filter((x) => x.kind === k.k).length] as const).filter(([, n]) => n);
      result.replaceChildren(
        note(`Topildi: ${items.length} ta (${by.map(([l, n]) => `${l.toLocaleLowerCase()} ${n}`).join(', ')}), taxminan ${fmtSize(total)}.` + (total > PART_BYTES ? ` Bir nechta ZIP bo'lib yuklanadi (har biri ~${fmtSize(PART_BYTES)}).` : '')),
        h('button', {type: 'button', className: 'tz-main', style: 'width:100%', onclick: () => download(items)}, 'ZIP qilib yuklab olish'));
    } catch(e: any) {
      busy = false;
      result.replaceChildren(note('Olib bo\'lmadi: ' + (e?.type || e?.message || e), '#d33'));
    }
  };

  const download = async(items: Item[]) => {
    if(busy || !peer) return;
    busy = true; cancel = false;
    const safe = peer.name.replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 40) || 'chat';
    const stopBtn = h('button', {type: 'button', onclick: () => { cancel = true; }}, 'To\'xtatish');
    result.replaceChildren(bar, status, stopBtn);
    let entries: ZipEntry[] = [], used = new Set<string>(), partBytes = 0, part = 1, ok = 0, skipped = 0, zips = 0;
    const total = items.reduce((s, x) => s + x.size, 0) || 1;
    let done = 0;
    const flush = () => {
      if(!entries.length) return;
      const multi = total > PART_BYTES;
      saveZip(buildZip(entries), `toza-media-${safe}${multi ? `-${part}` : ''}.zip`);
      zips++; part++; entries = []; used = new Set(); partBytes = 0;
    };
    try {
      for(let i = 0; i < items.length && !cancel; i++) {
        const it = items[i];
        status.textContent = `Yuklanmoqda: ${i + 1} / ${items.length} · ${fmtSize(done)} / ${fmtSize(total)}`;
        if(it.size > MAX_FILE) { skipped++; done += it.size; continue; }
        try {
          const opts: any = it.isPhoto ? {media: it.media, thumb: choosePhotoSize(it.media, 2560, 2560)} : {media: it.media};
          const blob: Blob = await (appDownloadManager as any).downloadMedia(opts);
          const data = new Uint8Array(await blob.arrayBuffer());
          if(partBytes && partBytes + data.length > PART_BYTES) flush();
          const dir = KINDS.find((k) => k.k === it.kind)!.dir;
          entries.push({name: `${dir}/${uniqueName(it.name, used)}`, data, date: new Date(it.date * 1000)});
          partBytes += data.length; ok++;
        } catch{ skipped++; }
        done += it.size;
        setBar(done / total);
      }
      flush();
      setBar(1);
      result.replaceChildren(note(`${cancel ? 'To\'xtatildi. ' : 'Tayyor! '}${ok} ta fayl${zips > 1 ? `, ${zips} ta ZIP` : ''} yuklab olindi${skipped ? `, ${skipped} tasini olib bo'lmadi (juda katta yoki xato)` : ''}. Brauzerning «Yuklanmalar» papkasiga qarang.`, '#2a9d4b'));
    } catch(e: any) {
      result.replaceChildren(note('Xato: ' + (e?.message || e), '#d33'));
    } finally { busy = false; }
  };

  paintPeer();
  box.append(
    note('Chatdagi rasm, video, fayl va ovozli xabarlarni bitta ZIP faylga yig\'ib yuklab oladi. Fayllar Telegram\'dan to\'g\'ri shu qurilmaga tushadi.'),
    peerSec,
    h('div', {className: 'tz-sec'}, h('b', {}, 'Nimalar'), kindsRow, h('b', {}, 'Qaysi davr'), periodRow, h('b', {}, 'Ko\'pi bilan (har tur uchun)'), maxRow,
      h('button', {type: 'button', className: 'tz-main', style: 'width:100%;margin-top:14px', onclick: find}, 'Qidirish')),
    result);
  return box;
}
