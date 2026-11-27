// Toza pleyeri: Telegram'ning video pleyeriga (media ko'rish oynasi, `.ckin__player`) qo'shimchalar.
// Tweb pleyerining o'zi o'zgarmaydi: video ijro boshlanganda unga bir marta ulanamiz.
//  - Ikki marta tegish: chap/o'ng tomonda ortga/oldinga (5/10/15 soniya).
//  - To'liq ekranda vertikal surish: chap yarmi yorqinlik, o'ng yarmi ovoz; gorizontal surish: vaqtni siljitish.
//  - Sichqoncha g'ildiragi: ovoz (Shift bilan yorqinlik). Klaviatura: ↑/↓ ovoz, J/L ortga/oldinga, B yorqinlik.
//  - «Toza» menyusi: yorqinlik, takrorlash, ekranga to'ldirish, kadrni saqlash.
//  - Uzun videoni to'xtagan joyidan davom ettirish.
import appMediaPlaybackController from '@components/appMediaPlaybackController';
import {ensureStyle} from './style';
import {icon} from './icons';
import {fmtTime, nextSeek, resumeAt} from './tools-core';
import {featureOn, FEATURES_EVENT} from './features';

export type PlayerPrefs = {gestures: boolean; seek: 5 | 10 | 15; resume: boolean; wheel: boolean; brightness: number};
const LS = 'toza_player', LS_POS = 'toza_player_pos';
const DEF: PlayerPrefs = {gestures: true, seek: 10, resume: true, wheel: true, brightness: 1};
const read = <T>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch{ return d; } };
const write = (k: string, v: any) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch{ /* xotira yopiq */ } };
export const playerPrefs = (): PlayerPrefs => ({...DEF, ...read<Partial<PlayerPrefs>>(LS, {})});
export const setPlayerPrefs = (p: Partial<PlayerPrefs>) => write(LS, {...playerPrefs(), ...p});

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const enhanced = new WeakSet<HTMLVideoElement>();

// ---------------------------------------------------------------- ovoz va yorqinlik
function setVolume(v: number) {
  v = clamp(Math.round(v * 100) / 100, 0, 1);
  const c = appMediaPlaybackController as any;
  if(v > 0 && c.muted) c.muted = false;
  c.volume = v;                                            // tweb'ning ovoz sozlamasi (slayder ham yangilanadi)
  return v;
}
const getVolume = () => { const c = appMediaPlaybackController as any; return c.muted ? 0 : (c.volume ?? 1); };
function applyBrightness(video: HTMLVideoElement, b = playerPrefs().brightness) {
  video.style.filter = Math.abs(b - 1) < 0.01 ? '' : `brightness(${b})`;
}
function setBrightness(video: HTMLVideoElement, b: number) {
  b = clamp(Math.round(b * 100) / 100, 0.3, 1.6);
  setPlayerPrefs({brightness: b});
  applyBrightness(video, b);
  return b;
}

// ---------------------------------------------------------------- ekrandagi belgi (HUD)
function hud(wrap: HTMLElement, ic: string, text: string, level?: number, action?: {label: string; fn: () => void}) {
  let el = wrap.querySelector<HTMLElement>(':scope > .tz-hud');
  if(!el) { el = document.createElement('div'); el.className = 'tz-hud ckin__controls'; el.setAttribute('role', 'status'); wrap.append(el); }
  el.replaceChildren();
  el.append(icon(ic, 22));
  const t = document.createElement('span'); t.textContent = text; el.append(t);
  if(level !== undefined) {
    const bar = document.createElement('i'); bar.className = 'tz-hud-bar';
    const fill = document.createElement('b'); fill.style.width = `${Math.round(clamp(level, 0, 1) * 100)}%`;
    bar.append(fill); el.append(bar);
  }
  if(action) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = action.label;
    b.onclick = (e) => { e.stopPropagation(); action.fn(); el.classList.remove('on'); };
    el.append(b);
  }
  el.classList.add('on');
  clearTimeout((el as any).tzT);
  (el as any).tzT = setTimeout(() => el.classList.remove('on'), action ? 4500 : 900);
}
const pct = (v: number) => `${Math.round(v * 100)}%`;

function seekBy(video: HTMLVideoElement, wrap: HTMLElement, sec: number) {
  if(!isFinite(video.duration)) return;
  video.currentTime = nextSeek(video.currentTime, video.duration, sec);
  hud(wrap, sec < 0 ? 'rewind' : 'forward', `${sec > 0 ? '+' : ''}${sec} s · ${fmtTime(video.currentTime)}`);
}

// ---------------------------------------------------------------- davom ettirish
const posKey = (v: HTMLVideoElement) => { const s = v.currentSrc || v.src || ''; return s.includes('stream/') ? s.slice(s.indexOf('stream/')).slice(0, 400) : ''; };
function savePos(video: HTMLVideoElement) {
  const k = posKey(video);
  if(!k || !isFinite(video.duration) || video.duration < 90) return;
  const all = read<Record<string, [number, number]>>(LS_POS, {});
  const done = video.currentTime > video.duration - 15 || video.currentTime < 10;
  if(done) delete all[k]; else all[k] = [Math.floor(video.currentTime), Date.now()];
  const keys = Object.keys(all);
  if(keys.length > 80) keys.sort((a, b) => all[a][1] - all[b][1]).slice(0, keys.length - 80).forEach((x) => delete all[x]);
  write(LS_POS, all);
}
function tryResume(video: HTMLVideoElement, wrap: HTMLElement) {
  if(!playerPrefs().resume) return;
  const go = () => {
    const at = resumeAt(read<Record<string, [number, number]>>(LS_POS, {})[posKey(video)]?.[0], video.duration);
    if(at === null) return;
    video.currentTime = at;
    hud(wrap, 'play', `Davom ettirildi: ${fmtTime(at)}`, undefined, {label: 'Boshidan', fn: () => { video.currentTime = 0; }});
  };
  if(video.readyState >= 1) go(); else video.addEventListener('loadedmetadata', go, {once: true});
}

// ---------------------------------------------------------------- «Toza» menyusi
function menu(video: HTMLVideoElement, wrap: HTMLElement, btn: HTMLElement) {
  const old = wrap.querySelector('.tz-pmenu');
  if(old) { old.remove(); return; }
  ensureStyle();
  const m = document.createElement('div');
  m.className = 'tz-pmenu ckin__controls';
  m.setAttribute('role', 'menu');
  const stop = (e: Event) => e.stopPropagation();
  ['click', 'pointerdown', 'touchstart', 'dblclick', 'wheel'].forEach((ev) => m.addEventListener(ev, stop));

  const slider = document.createElement('input');
  slider.type = 'range'; slider.min = '30'; slider.max = '160'; slider.step = '5';
  slider.value = String(Math.round(playerPrefs().brightness * 100));
  slider.setAttribute('aria-label', 'Yorqinlik');
  const val = document.createElement('span'); val.className = 'tz-pm-v'; val.textContent = pct(playerPrefs().brightness);
  slider.oninput = () => { val.textContent = pct(setBrightness(video, +slider.value / 100)); };
  const br = document.createElement('div'); br.className = 'tz-pm-row';
  br.append(icon('sun', 20), slider, val);

  const item = (ic: string, label: string, on: () => boolean, fn: () => void) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tz-pm-item'; b.setAttribute('role', 'menuitemcheckbox');
    const paint = () => { b.classList.toggle('on', on()); b.setAttribute('aria-checked', String(on())); };
    b.append(icon(ic, 20), document.createTextNode(label));
    b.onclick = (e) => { e.stopPropagation(); fn(); paint(); };
    paint();
    return b;
  };
  m.append(br,
    item('loop', 'Takrorlash', () => video.loop, () => { video.loop = !video.loop; }),
    item('expand', 'Ekranga to\'ldirish', () => video.classList.contains('tz-cover'), () => video.classList.toggle('tz-cover')),
    item('camera', 'Kadrni saqlash', () => false, () => snapshot(video, wrap)),
    item('sun', 'Yorqinlikni tiklash', () => false, () => { setBrightness(video, 1); slider.value = '100'; val.textContent = '100%'; }));
  wrap.append(m);
  const off = (e: Event) => { if(!m.contains(e.target as Node) && e.target !== btn && !btn.contains(e.target as Node)) { m.remove(); document.removeEventListener('pointerdown', off, true); } };
  document.addEventListener('pointerdown', off, true);
}

function snapshot(video: HTMLVideoElement, wrap: HTMLElement) {
  try {
    const c = document.createElement('canvas');
    c.width = video.videoWidth; c.height = video.videoHeight;
    if(!c.width) return;
    c.getContext('2d').drawImage(video, 0, 0);
    c.toBlob((blob) => {
      if(!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `toza-kadr-${fmtTime(video.currentTime).replace(/:/g, '-')}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      hud(wrap, 'camera', 'Kadr saqlandi');
    }, 'image/png');
  } catch{ hud(wrap, 'camera', 'Bu videodan kadr olib bo\'lmadi'); }
}

// ---------------------------------------------------------------- imo-ishoralar
function bindGestures(video: HTMLVideoElement, wrap: HTMLElement) {
  let lastTap = 0, lastX = 0;
  let start: {x: number; y: number; t: number; vol: number; br: number; time: number; mode: '' | 'v' | 'b' | 's'} | null = null;
  const full = () => wrap.classList.contains('ckin__fullscreen');

  wrap.addEventListener('touchstart', (e) => {
    if(!featureOn('player') || !playerPrefs().gestures || e.touches.length !== 1 || (e.target as Element).closest?.('.default__controls, .tz-pmenu, .tz-hud')) { start = null; return; }
    const p = e.touches[0];
    start = {x: p.clientX, y: p.clientY, t: video.currentTime, vol: getVolume(), br: playerPrefs().brightness, time: Date.now(), mode: ''};
  }, {passive: true});

  wrap.addEventListener('touchmove', (e) => {
    if(!start || !full()) return;                            // oddiy ko'rishda surish = oynani yopish (tweb), unga tegmaymiz
    const p = e.touches[0], dx = p.clientX - start.x, dy = p.clientY - start.y;
    const r = wrap.getBoundingClientRect();
    if(!start.mode) {
      if(Math.hypot(dx, dy) < 14) return;
      start.mode = Math.abs(dy) > Math.abs(dx) ? (start.x - r.left < r.width / 2 ? 'b' : 'v') : 's';
    }
    e.preventDefault(); e.stopPropagation();
    if(start.mode === 'v') { const v = setVolume(start.vol - dy / (r.height * 0.7)); hud(wrap, v ? 'volume' : 'mute', `Ovoz ${pct(v)}`, v); }
    else if(start.mode === 'b') { const b = setBrightness(video, start.br - dy / (r.height * 0.6)); hud(wrap, 'sun', `Yorqinlik ${pct(b)}`, (b - 0.3) / 1.3); }
    else if(isFinite(video.duration)) {
      const to = clamp(start.t + dx / r.width * Math.min(video.duration, 180), 0, video.duration);
      video.currentTime = to;
      hud(wrap, dx < 0 ? 'rewind' : 'forward', `${fmtTime(to)} / ${fmtTime(video.duration)}`, to / video.duration);
    }
  }, {passive: false, capture: true});

  wrap.addEventListener('touchend', (e) => {
    const s = start; start = null;
    if(!s || s.mode || Date.now() - s.time > 300 || !playerPrefs().gestures) return;
    const r = wrap.getBoundingClientRect(), x = s.x - r.left, now = Date.now();
    const side = x < r.width * 0.38 ? -1 : x > r.width * 0.62 ? 1 : 0;
    if(side && now - lastTap < 320 && Math.abs(s.x - lastX) < 70) {
      e.preventDefault();
      seekBy(video, wrap, side * playerPrefs().seek);
      lastTap = 0;
      return;
    }
    lastTap = now; lastX = s.x;
  });

  wrap.addEventListener('wheel', (e) => {
    if(!featureOn('player') || !playerPrefs().wheel || (e.target as Element).closest?.('.tz-pmenu')) return;
    e.preventDefault();
    const step = e.deltaY < 0 ? 0.05 : -0.05;
    if(e.shiftKey) { const b = setBrightness(video, playerPrefs().brightness + step); hud(wrap, 'sun', `Yorqinlik ${pct(b)}`, (b - 0.3) / 1.3); }
    else { const v = setVolume(getVolume() + step); hud(wrap, v ? 'volume' : 'mute', `Ovoz ${pct(v)}`, v); }
  }, {passive: false});
}

/** Ko'rish oynasidagi faol video uchun klaviatura (bitta umumiy tinglovchi). */
let active: {video: HTMLVideoElement; wrap: HTMLElement} | null = null;
function onKey(e: KeyboardEvent) {
  if(!featureOn('player') || !active || !active.wrap.isConnected || e.ctrlKey || e.metaKey || e.altKey) return;
  const inViewer = !!active.wrap.closest('.media-viewer-whole') || active.wrap.classList.contains('ckin__fullscreen');
  if(!inViewer || (document.activeElement as HTMLElement)?.matches?.('input, textarea, [contenteditable="true"]')) return;
  const {video, wrap} = active;
  let done = true;
  if(e.code === 'ArrowUp' || e.code === 'ArrowDown') { const v = setVolume(getVolume() + (e.code === 'ArrowUp' ? 0.05 : -0.05)); hud(wrap, v ? 'volume' : 'mute', `Ovoz ${pct(v)}`, v); }
  else if(e.code === 'KeyJ') seekBy(video, wrap, -playerPrefs().seek);
  else if(e.code === 'KeyL') seekBy(video, wrap, playerPrefs().seek);
  else if(e.code === 'KeyB') { const b = setBrightness(video, e.shiftKey ? playerPrefs().brightness - 0.1 : playerPrefs().brightness + 0.1 > 1.6 ? 0.3 : playerPrefs().brightness + 0.1); hud(wrap, 'sun', `Yorqinlik ${pct(b)}`, (b - 0.3) / 1.3); }
  else done = false;
  if(done) { e.preventDefault(); e.stopPropagation(); }
}

function enhance(video: HTMLVideoElement) {
  if(!featureOn('player')) return;
  const wrap = video.closest<HTMLElement>('.ckin__player');
  if(!wrap) return;
  active = {video, wrap};
  if(enhanced.has(video)) return;
  enhanced.add(video);
  ensureStyle();
  applyBrightness(video);
  const br = playerPrefs().brightness;
  if(Math.abs(br - 1) >= 0.01) setTimeout(() => hud(wrap, 'sun', `Yorqinlik ${pct(br)}`, undefined, {label: 'Tiklash', fn: () => setBrightness(video, 1)}), 600);
  const right = wrap.querySelector('.right-controls');
  if(right && !right.querySelector('.tz-pbtn')) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn-icon default__button tz-pbtn'; b.title = 'Toza: yorqinlik, takrorlash, kadr';
    b.setAttribute('aria-label', 'Toza pleyer sozlamalari');
    b.append(icon('tune', 22));
    b.onclick = (e) => { e.stopPropagation(); menu(video, wrap, b); };
    right.prepend(b);
  }
  bindGestures(video, wrap);
  tryResume(video, wrap);
  let last = 0;
  video.addEventListener('timeupdate', () => { const n = Date.now(); if(n - last > 5000) { last = n; savePos(video); } });
  video.addEventListener('pause', () => savePos(video));
}

let started = false;
export function startPlayer() {
  if(started) return;
  started = true;
  // media hodisalari yuqoriga ko'tarilmaydi, shuning uchun «capture» bilan tinglaymiz
  document.addEventListener('play', (e) => {
    const v = e.target as HTMLVideoElement;
    if(v instanceof HTMLVideoElement && v.closest('.ckin__player')) enhance(v);
  }, true);
  document.addEventListener('keydown', onKey, true);
  // o'chirilganda ochiq pleyerdan Toza qo'shimchalarini darrov olib tashlaymiz
  window.addEventListener(FEATURES_EVENT, (e: Event) => {
    const d = (e as CustomEvent).detail;
    if(d?.k !== 'player' || d.on) return;
    document.querySelectorAll('.tz-pbtn, .tz-hud, .tz-pmenu').forEach((el) => el.remove());
    document.querySelectorAll<HTMLVideoElement>('.ckin__player video').forEach((v) => { v.style.filter = ''; });
    active = null;
  });
}
