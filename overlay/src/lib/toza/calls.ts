// Qo'ng'iroqni kuchaytirish (1:1 qo'ng'iroqlar, tweb CallInstance ustida, tweb kodiga tegmasdan):
//  - aloqa sifati ko'rsatkichi: qo'ng'iroq oynasida «Aloqa: Yaxshi · 80 ms» (feature `callinfo`);
//  - video sifatini avtomatik pasaytirish: aloqa zaiflashsa o'z videomiz o'lchami/kadr tezligi/bitreyti kamayadi (feature `calladapt`);
//  - video qotsa ovozga o'tish: aloqa juda zaif yoki kelayotgan video qotib qolsa o'z kameramiz o'chadi, qo'ng'iroq uzilmaydi;
//    aloqa tiklansa «Videoni qaytarish» taklif qilinadi (feature `callaudio`).
// O'lchov: RTCPeerConnection.getStats() har soniyada (tweb'ning o'zi ham shunday qiladi, signal ustunlari uchun).
import callsController from '@lib/calls/callsController';
import CALL_STATE from '@lib/calls/callState';
import {featureOn} from './features';
import {FallbackTracker, FreezeDetector, TIER_LABEL, TierSmoother, tierOf, videoCap} from './net-core';
import type {Sample, Tier, VideoCap} from './net-core';

const CSS = `
.tz-callq{display:inline-flex;align-items:center;gap:6px;margin:8px auto 0;padding:5px 12px;border-radius:14px;background:rgba(0,0,0,.28);color:#fff;font:600 13px/1.2 var(--font-regular,system-ui,sans-serif);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);pointer-events:none;max-width:calc(100% - 24px)}
.tz-callq i{width:8px;height:8px;border-radius:50%;flex:none;background:#4cd964}
.tz-callq[data-t=ok] i{background:#a8e05f}.tz-callq[data-t=weak] i{background:#ffb02e}.tz-callq[data-t=bad] i{background:#ff5b5b}
.tz-callq-wrap{display:flex;flex-direction:column;align-items:center;gap:6px;width:100%}
.tz-callfb{display:flex;align-items:center;gap:10px;padding:8px 8px 8px 14px;border-radius:16px;background:rgba(0,0,0,.45);color:#fff;font:500 13px/1.3 var(--font-regular,system-ui,sans-serif);max-width:calc(100% - 24px)}
.tz-callfb button{border:0;border-radius:12px;padding:7px 12px;background:#fff;color:#000;font:700 13px/1 var(--font-regular,system-ui,sans-serif);cursor:pointer;flex:none}
.tz-callfb button.tz-x{background:transparent;color:#fff;padding:7px}
`;
function ensureCss() {
  if(document.getElementById('tz-calls-css')) return;
  const s = document.createElement('style'); s.id = 'tz-calls-css'; s.textContent = CSS; document.head.append(s);
}

type Watch = {timer: number; prev?: {lost: number; recv: number}; smooth: TierSmoother; fb: FallbackTracker; frz: FreezeDetector; cap: VideoCap; capKey: string; chip?: HTMLElement; banner?: HTMLElement};
const watched = new WeakMap<object, Watch>();

async function sample(pc: RTCPeerConnection, w: Watch): Promise<Sample & {frames?: number}> {
  const st = await pc.getStats();
  let pairId = '', kbps: number | undefined, rtt: number | undefined, frames: number | undefined, lost = 0, recv = 0;
  st.forEach((r: any) => { if(r.type === 'transport' && r.selectedCandidatePairId) pairId = r.selectedCandidatePairId; });
  st.forEach((r: any) => {
    if(r.type === 'candidate-pair' && (pairId ? r.id === pairId : (r.nominated && r.state === 'succeeded'))) {
      if(typeof r.availableOutgoingBitrate === 'number') kbps = r.availableOutgoingBitrate / 1000;
      if(typeof r.currentRoundTripTime === 'number') rtt = r.currentRoundTripTime * 1000;
    }
    if(r.type === 'inbound-rtp') {
      lost += Math.max(0, r.packetsLost || 0); recv += r.packetsReceived || 0;
      if(r.kind === 'video' && typeof r.framesDecoded === 'number') frames = (frames || 0) + r.framesDecoded;
    }
  });
  let loss: number | undefined;
  if(w.prev) { const dl = lost - w.prev.lost, dr = recv - w.prev.recv; if(dl + dr > 20) loss = (dl / (dl + dr)) * 100; }
  w.prev = {lost, recv};
  return {kbps, rtt, loss, frames};
}

async function applyCap(call: any, w: Watch, cap: VideoCap) {
  const sender: RTCRtpSender | undefined = call.p2p?.senders?.video;
  const key = JSON.stringify(cap);
  if(!sender?.track?.enabled) { w.capKey = ''; return; }
  if(key === w.capKey) return;
  try {
    const p = sender.getParameters();
    const e = p.encodings?.[0];
    if(!e) return;
    if(cap) { e.maxBitrate = cap.maxBitrate; e.scaleResolutionDownBy = cap.scaleResolutionDownBy; e.maxFramerate = cap.maxFramerate; } else { delete e.maxBitrate; e.scaleResolutionDownBy = 1; delete e.maxFramerate; }
    await sender.setParameters(p);
    w.capKey = key;
  } catch{ /* parametrlar band yoki qo'llab-quvvatlanmaydi: keyingi soniyada yana urinamiz */ }
}

function popupInfo(): HTMLElement | null {
  const pop = document.querySelector('.popup-call');
  return (pop?.querySelector('.call-info') || pop?.querySelector('.call-subtitle')?.parentElement || null) as HTMLElement | null;
}
function wrapOf(): HTMLElement | null {
  const info = popupInfo();
  if(!info) return null;
  let wrap = info.querySelector<HTMLElement>(':scope > .tz-callq-wrap');
  if(!wrap) { wrap = document.createElement('div'); wrap.className = 'tz-callq-wrap'; info.append(wrap); }
  return wrap;
}

function paintChip(w: Watch, t: Tier, s: Sample) {
  if(!featureOn('callinfo')) { w.chip?.remove(); return; }
  const wrap = wrapOf();
  if(!wrap) return;
  if(!w.chip || !w.chip.isConnected) { w.chip = document.createElement('div'); w.chip.className = 'tz-callq'; w.chip.setAttribute('role', 'status'); wrap.prepend(w.chip); }
  const parts = [`Aloqa: ${TIER_LABEL[t]}`];
  if(s.rtt !== undefined) parts.push(`${Math.round(s.rtt)} ms`);
  if(w.cap) parts.push('video pasaytirildi');
  w.chip.dataset.t = t;
  w.chip.replaceChildren(document.createElement('i'), parts.join(' · '));
}

function showBanner(w: Watch, text: string, action?: [string, () => void]) {
  w.banner?.remove();
  const wrap = wrapOf();
  if(!wrap) return;
  const b = document.createElement('div'); b.className = 'tz-callfb'; b.setAttribute('role', 'status');
  b.append(document.createElement('span'));
  (b.firstChild as HTMLElement).textContent = text;
  if(action) { const x = document.createElement('button'); x.type = 'button'; x.textContent = action[0]; x.onclick = () => { b.remove(); action[1](); }; b.append(x); }
  const c = document.createElement('button'); c.type = 'button'; c.className = 'tz-x'; c.textContent = '✕'; c.setAttribute('aria-label', 'Yopish'); c.onclick = () => b.remove(); b.append(c);
  wrap.append(b);
  w.banner = b;
  window.setTimeout(() => { if(w.banner === b && !action) b.remove(); }, 8000);
}

function stop(call: any) {
  const w = watched.get(call);
  if(!w) return;
  clearInterval(w.timer); w.chip?.remove(); w.banner?.remove();
  watched.delete(call);
}

function watch(call: any) {
  if(watched.has(call) || call.isGroupCall) return;
  const w: Watch = {timer: 0, smooth: new TierSmoother(), fb: new FallbackTracker(), frz: new FreezeDetector(), cap: null, capKey: ''};
  watched.set(call, w);
  let busy = false;
  w.timer = window.setInterval(async() => {
    const pc: RTCPeerConnection | undefined = call.p2p?.connection;
    if(call.connectionState === CALL_STATE.CLOSED) { stop(call); return; }
    if(!pc || call.connectionState !== CALL_STATE.CONNECTED || busy) return;
    busy = true;
    try {
      const s = await sample(pc, w);
      const t = w.smooth.push(tierOf(s));
      const remoteVideo = call.p2p?.remoteMediaState?.videoState === 'active';
      const frozen = w.frz.push(s.frames, remoteVideo);
      w.cap = featureOn('calladapt') ? videoCap(t) : null;
      await applyCap(call, w, w.cap);
      paintChip(w, t, s);
      if(featureOn('callaudio')) {
        const act = w.fb.push(t, frozen, !!call.isSharingVideo);
        if(act === 'toAudio') {
          await call.toggleVideoSharing?.();
          showBanner(w, frozen ? 'Video qotib qoldi: kamerangiz o\'chirildi, ovoz davom etmoqda.' : 'Aloqa juda zaif: kamerangiz o\'chirildi, ovoz davom etmoqda.');
        } else if(act === 'backToVideo') {
          showBanner(w, 'Aloqa yaxshilandi.', ['Videoni qaytarish', () => { call.toggleVideoSharing?.(); }]);
        }
      }
    } catch{ /* o'lchab bo'lmadi */ } finally { busy = false; }
  }, 1000);
}

let started = false;
export function startCallBoost() {
  if(started) return;
  started = true;
  ensureCss();
  try {
    (callsController as any).addEventListener('instance', ({instance}: any) => watch(instance));
    const cur = (callsController as any).currentCall;
    if(cur) watch(cur);
  } catch{ /* qo'ng'iroqlar qo'llab-quvvatlanmaydi */ }
}
