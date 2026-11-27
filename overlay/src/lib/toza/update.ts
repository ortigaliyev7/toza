// Avtomatik yangilanish: serverdagi `toza-version.txt` (build.sh yozadi) bilan shu nusxaning versiyasi (VITE_TOZA_BUILD) solishtiriladi.
// Yangi versiya chiqsa: Toza fonda bo'lsa darrov, ekranda bo'lsa foydalanuvchi bo'sh turganda (10 soniya ogohlantirib) qayta yuklanadi.
// Qayta ochilgach «Toza yangilandi» oynasida nima o'zgargani ko'rsatiladi (bir marta).
import {ensureStyle} from './style';
import {icon} from './icons';

type Notes = {date: string; items: string[]}[];
const CURRENT = String((import.meta as any).env?.VITE_TOZA_BUILD || '');
const LS_SEEN = 'toza_build_seen', LS_PENDING = 'toza_update_from';
const CHECK_MS = 5 * 60 * 1000, COUNTDOWN_S = 10;

let pending: {v: string; notes: Notes} | null = null;
let countdown: HTMLElement | null = null;

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k) || ''; } catch{ return ''; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch{ /* xotira yopiq */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch{ /* xotira yopiq */ } }
};

async function fetchLatest(): Promise<{v: string; notes: Notes} | null> {
  try {
    const r = await fetch('toza-version.txt', {cache: 'no-store'});                  // .txt: tweb service worker'i keshlamaydi;
    if(!r.ok) return null;
    const j = await r.json();
    return j && typeof j.v === 'string' && j.v ? {v: j.v, notes: Array.isArray(j.notes) ? j.notes : []} : null;
  } catch{ return null; }
}

/** Foydalanuvchi hozir biror narsa yozyaptimi yoki oyna ochiqmi (bunda qayta yuklamaymiz). */
function busy(): boolean {
  const typed = Array.from(document.querySelectorAll<HTMLElement>('.input-message-input[contenteditable="true"]')).some((el) => (el.innerText || '').trim());
  const focusInput = document.activeElement?.matches?.('input, textarea, [contenteditable="true"]');
  return typed || playing() || recording() || !!focusInput || !!document.querySelector('.tz-back, .popup.active, .media-viewer-whole, #stories-viewer .stories-viewer') || !!document.pictureInPictureElement;
}

/** Ovozli yoki video xabar yozilyaptimi (yozish to'xtab qolmasin). */
const recording = () => !!document.querySelector('.chat-input.is-recording, .is-recording');

/** Qo'ng'iroq, ovoz yoki video ijro bo'lyaptimi (fonda ham uzib qo'ymaymiz). */
const playing = () => Array.from(document.querySelectorAll<HTMLMediaElement>('audio, video')).some((m) => !m.paused && !m.muted && m.readyState > 2);

function reloadNow() {
  if(playing() || recording()) return;                    // keyingi tekshiruvda
  ls.set(LS_PENDING, CURRENT);
  location.reload();
}

function showCountdown() {
  if(countdown) return;
  ensureStyle();
  let left = COUNTDOWN_S;
  const el = document.createElement('div');
  el.className = 'tz-upd';
  const txt = document.createElement('div'); txt.className = 'tz-upd-t';
  const now = document.createElement('button'); now.type = 'button'; now.className = 'tz-upd-go'; now.textContent = 'Hozir';
  const later = document.createElement('button'); later.type = 'button'; later.className = 'tz-upd-later'; later.textContent = 'Keyinroq';
  const ic = document.createElement('span'); ic.className = 'tz-upd-ic'; ic.append(icon('download', 18));
  el.append(ic, txt, now, later);
  const paint = () => { txt.textContent = `Toza'ning yangi versiyasi tayyor. ${left} soniyadan keyin qayta yuklanadi.`; };
  paint();
  const timer = window.setInterval(() => {
    left--;
    if(left <= 0) { clearInterval(timer); busy() ? close() : reloadNow(); return; }
    paint();
  }, 1000);
  // foydalanuvchi ekranga tegsa yoki yozsa — o'z-o'zidan qayta yuklamaymiz, faqat tugma qoladi
  const hold = (e: Event) => {
    if(el.contains(e.target as Node)) return;
    clearInterval(timer);
    txt.textContent = 'Toza\'ning yangi versiyasi tayyor. Qulay paytda «Yangilash»ni bosing.';
    now.textContent = 'Yangilash';
    unhold();
  };
  const unhold = () => { document.removeEventListener('pointerdown', hold, true); document.removeEventListener('keydown', hold, true); };
  document.addEventListener('pointerdown', hold, true);
  document.addEventListener('keydown', hold, true);
  const close = () => { clearInterval(timer); unhold(); el.remove(); countdown = null; };
  now.onclick = () => { clearInterval(timer); unhold(); reloadNow(); };
  later.onclick = () => close();                         // Toza fonga o'tganda yoki keyingi tekshiruvda yangilanadi
  document.body.append(el);
  countdown = el;
}

async function check() {
  if(!CURRENT) return;
  const latest = pending || await fetchLatest();
  if(!latest || latest.v === CURRENT) return;
  pending = latest;
  if(document.hidden) reloadNow();                         // ko'rinmayapti: darrov, sezdirmasdan
  else if(!busy()) showCountdown();
}

/** Yangilangandan keyin: nima o'zgargani (bir marta). Birinchi o'rnatishda ko'rsatilmaydi. */
async function announce() {
  const seen = ls.get(LS_SEEN), from = ls.get(LS_PENDING);
  ls.set(LS_SEEN, CURRENT);
  ls.del(LS_PENDING);
  if(!seen || seen === CURRENT) {
    if(!from) return;                                     // birinchi ochilish yoki o'zgarish yo'q
  }
  const latest = await fetchLatest();
  const notes = latest?.v === CURRENT ? latest.notes : [];
  ensureStyle();
  const back = document.createElement('div'); back.className = 'tz-back';
  const pop = document.createElement('div'); pop.className = 'tz-pop';
  const head = document.createElement('div'); head.className = 'tz-head'; head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;';
  const b = document.createElement('b'); b.textContent = 'Toza yangilandi';
  const x = document.createElement('button'); x.className = 'tz-x'; x.textContent = '✕';
  head.append(b, x);
  const sec = document.createElement('div'); sec.className = 'tz-sec';
  const items = notes[0]?.items?.length ? notes[0].items : ['Kichik tuzatishlar va yaxshilanishlar.'];
  for(const it of items.slice(0, 8)) {
    const row = document.createElement('div'); row.className = 'tz-row';
    const ic = document.createElement('span'); ic.className = 'tz-ic tz-soft'; ic.textContent = '✓';
    const t = document.createElement('div'); t.className = 'tz-tx'; t.style.fontWeight = '500'; t.textContent = it;
    row.append(ic, t);
    sec.append(row);
  }
  const ok = document.createElement('button'); ok.className = 'tz-main'; ok.textContent = 'Yaxshi'; ok.style.cssText = 'width:calc(100% - 36px);margin-top:14px!important;';
  pop.append(head, sec, ok);
  back.append(pop);
  const close = () => back.remove();
  x.onclick = ok.onclick = close;
  back.addEventListener('mousedown', (e) => { if(e.target === back) close(); });
  document.body.append(back);
}

let started = false;
export function startAutoUpdate() {
  if(started || !CURRENT) return;
  started = true;
  setTimeout(() => { announce().catch((): void => undefined); }, 2500);
  setTimeout(check, 20000);
  window.setInterval(check, CHECK_MS);
  document.addEventListener('visibilitychange', () => {
    if(document.hidden && pending) reloadNow();
    else if(!document.hidden) check();
  });
  window.addEventListener('online', () => check());
}
