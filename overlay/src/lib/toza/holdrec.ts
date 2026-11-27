// Ovozli xabar va dumaloq videoni telefondagi Telegram kabi yozish (faqat sensorli ekranda):
//  - mikrofon tugmasini bosib turing: yozish boshlanadi;
//  - qo'yib yuboring: yuboriladi;
//  - chapga suring: bekor qilinadi;
//  - yuqoriga suring: qulflanadi (barmoqni olsangiz ham yozish davom etadi, keyin «Yuborish»ni bosasiz);
//  - qisqa bosish: ovozli xabar ↔ dumaloq video rejimini almashtiradi.
// tweb'ning o'zi o'zgarmaydi: tugmaga tegishni oldinroq (capture) ushlab, ChatRecording'ning ochiq usullarini chaqiramiz.
import {hotReloadGuard} from '@lib/solidjs/hotReloadGuardProvider';
import {ensureStyle} from './style';
import {featureOn} from './features';

const HOLD_MS = 220, CANCEL_DX = 110, LOCK_DY = 90;
const IS_TOUCH = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

type Rc = {active: boolean; hasAnyRecorder(): boolean; startActive(): void; handleSendButtonClick(): void; onCancelRecordClick(): void; canSwitchRecordingMode(): boolean; setRecordingMediaType(t: 'voice' | 'video'): void; getActiveRecordingMediaType(): 'voice' | 'video'};

function inputFor(btn: HTMLElement): any {
  const chat = (hotReloadGuard as any).appImManager?.chat;
  const input = chat?.input;
  return input?.btnSend === btn ? input : undefined;
}
/** Tugma hozir mikrofon/kamera ko'rinishidami (matn yo'q, yozilmayapti, tahrir/uzatish emas). */
function idle(input: any): boolean {
  const rc: Rc = input?.recordingController;
  return !!rc && rc.hasAnyRecorder() && !rc.active && !input.recording &&
    (input.sendBtnIcon === 'record' || input.sendBtnIcon === 'record-video');
}

let hint: HTMLElement | null = null;
function showHint(btn: HTMLElement, text: string, kind: 'hold' | 'toast' = 'hold') {
  ensureStyle();
  hint?.remove();
  const r = btn.getBoundingClientRect();
  hint = document.createElement('div');
  hint.className = 'tz-hold tz-hold-' + kind;
  hint.setAttribute('role', 'status');
  hint.style.bottom = `${Math.max(8, window.innerHeight - r.top + 10)}px`;
  if(kind === 'hold') {
    hint.style.right = `${Math.max(8, window.innerWidth - r.right)}px`;
    const lock = document.createElement('div'); lock.className = 'tz-hold-lock'; lock.textContent = '🔒\n⌃';
    const cancel = document.createElement('div'); cancel.className = 'tz-hold-cancel'; cancel.textContent = text;
    hint.append(lock, cancel);
  } else {
    hint.style.left = '50%';
    hint.textContent = text;
    const el = hint;
    setTimeout(() => { if(hint === el) { el.remove(); hint = null; } }, 2200);
  }
  document.body.append(hint);
}
const hideHint = () => { hint?.remove(); hint = null; };

let started = false;
export function startHoldRecord() {
  if(started || !IS_TOUCH) return;
  started = true;

  let g: {btn: HTMLElement; input: any; rc: Rc; x: number; y: number; timer: number; holding: boolean; done: boolean} | null = null;

  const finish = (how: 'send' | 'cancel' | 'lock') => {
    if(!g || g.done) return;
    const s = g; s.done = true;
    clearTimeout(s.timer);
    hideHint();
    if(!s.holding) return;
    if(how === 'lock') { s.btn.classList.remove('tz-holding'); return; }
    s.btn.classList.remove('tz-holding');
    const go = () => {
      if(!s.rc.active) return false;
      if(how === 'send') s.rc.handleSendButtonClick(); else s.rc.onCancelRecordClick();
      return true;
    };
    // ruxsat so'rash yoki kamera ishga tushishi davomida: yozish boshlangach bajaramiz (eng ko'pi 4 soniya)
    if(!go()) {
      if(how === 'send') return;                         // bekor qilinmagan yozuv qulflangan holda qoladi, «Yuborish»ni bosasiz
      let n = 0; const t = window.setInterval(() => { if(go() || ++n > 40) clearInterval(t); }, 100);
    }
  };

  window.addEventListener('touchstart', (e) => {
    if(!featureOn('holdrec') || e.touches.length !== 1) return;
    const btn = (e.target as Element)?.closest?.('.btn-send') as HTMLElement | null;
    if(!btn) return;
    const input = inputFor(btn);
    if(!idle(input)) return;
    e.preventDefault();                                  // tweb'ning «bosish» va uzoq bosish menyusi ishlamasin
    e.stopPropagation();
    const t = e.touches[0];
    const rc: Rc = input.recordingController;
    g = {btn, input, rc, x: t.clientX, y: t.clientY, holding: false, done: false, timer: 0};
    const s = g;
    s.timer = window.setTimeout(() => {
      if(s.done) return;
      s.holding = true;
      btn.classList.add('tz-holding');
      try { navigator.vibrate?.(20); } catch{ /* yo'q */ }
      rc.startActive();
      showHint(btn, '‹ Bekor qilish uchun chapga suring');
    }, HOLD_MS);
  }, {capture: true, passive: false});

  window.addEventListener('touchmove', (e) => {
    if(!g || g.done) return;
    const t = e.touches[0]; if(!t) return;
    const dx = t.clientX - g.x, dy = t.clientY - g.y;
    if(!g.holding) { if(Math.hypot(dx, dy) > 20) { clearTimeout(g.timer); g.done = true; } return; }
    e.preventDefault();
    if(dx <= -CANCEL_DX) { finish('cancel'); return; }
    if(dy <= -LOCK_DY) { finish('lock'); return; }
    if(hint) {
      const c = hint.querySelector<HTMLElement>('.tz-hold-cancel'), l = hint.querySelector<HTMLElement>('.tz-hold-lock');
      if(c) { c.style.transform = `translateX(${Math.min(0, dx)}px)`; c.style.opacity = String(1 - Math.min(0.7, -Math.min(0, dx) / CANCEL_DX)); }
      if(l) l.style.transform = `translateY(${Math.min(0, dy) / 2}px)`;
    }
  }, {capture: true, passive: false});

  const end = (e: TouchEvent, cancelled: boolean) => {
    if(!g) return;
    const s = g; g = null;
    if(s.done) return;
    e.preventDefault();
    if(!s.holding) {
      // qisqa bosish: rejimni almashtirish (telefondagi Telegram kabi)
      clearTimeout(s.timer); s.done = true;
      if(s.rc.canSwitchRecordingMode()) {
        const next = s.rc.getActiveRecordingMediaType() === 'voice' ? 'video' : 'voice';
        s.rc.setRecordingMediaType(next);
        showHint(s.btn, next === 'video' ? 'Dumaloq video: bosib turib yozing' : 'Ovozli xabar: bosib turib yozing', 'toast');
      } else {
        showHint(s.btn, 'Bosib turing: yoziladi, qo\'yib yuborsangiz yuboriladi', 'toast');
      }
      return;
    }
    // touchcancel ruxsat so'rovi chiqqanda ham keladi: yozish hali boshlanmagan bo'lsa bekor qilmaymiz, qulflab qoldiramiz
    g = s; finish(cancelled ? (s.rc.active ? 'cancel' : 'lock') : 'send'); g = null;
  };
  window.addEventListener('touchend', (e) => end(e, false), {capture: true, passive: false});
  window.addEventListener('touchcancel', (e) => end(e, true), {capture: true, passive: false});
  // tweb'ning uzoq bosish menyusi (Android: contextmenu) yozish paytida ochilmasin
  window.addEventListener('contextmenu', (e) => { if(g && (e.target as Element)?.closest?.('.btn-send')) { e.preventDefault(); e.stopPropagation(); } }, true);
}
