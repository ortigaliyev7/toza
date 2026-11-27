// Dumaloq video yozayotganda old/orqa kamerani almashtirish tugmasi (yozish to'xtamaydi).
// tweb tomoni: patches/0004-toza-round-camera.patch (`toza-round-start` hodisasi, recorder.tozaSwitchCamera).
import {ensureStyle} from './style';
import {icon} from './icons';
import {featureOn, FEATURES_EVENT} from './features';

type Rec = {tozaSwitchCamera(): Promise<'user' | 'environment'>; tozaFacing: 'user' | 'environment'; stream: MediaStream};
type Panel = {element: HTMLElement; previewVideo: HTMLVideoElement};

let cameras: Promise<number> | null = null;
const cameraCount = () => cameras ||= navigator.mediaDevices?.enumerateDevices?.()
.then((d) => d.filter((x) => x.kind === 'videoinput').length).catch(() => 0) ?? Promise.resolve(0);

async function mount(rec: Rec, panel: Panel) {
  const circle = panel.element.querySelector<HTMLElement>('.video-recording-circle');
  if(!circle) return;
  const paintMirror = () => panel.element.classList.toggle('tz-backcam', rec.tozaFacing === 'environment');
  paintMirror();
  if(circle.querySelector('.tz-flip')) return;
  cameras = null;                                                     // ruxsat berilgach ro'yxat to'liq chiqadi
  if(await cameraCount() < 2) return;
  ensureStyle();
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'tz-flip';
  b.setAttribute('aria-label', 'Kamerani almashtirish');
  b.title = 'Old / orqa kamera';
  b.append(icon('flip', 22));
  const stop = (e: Event) => { e.stopPropagation(); };
  ['pointerdown', 'mousedown', 'touchstart'].forEach((ev) => b.addEventListener(ev, stop));
  b.onclick = async(e) => {
    e.stopPropagation(); e.preventDefault();
    if(b.disabled) return;
    b.disabled = true;
    try {
      await rec.tozaSwitchCamera();
      panel.previewVideo.srcObject = rec.stream;
      await panel.previewVideo.play().catch((): void => undefined);
      paintMirror();
    } catch{ /* kamera band yoki yo'q */ } finally { b.disabled = false; }
  };
  circle.append(b);
}

let started = false;
export function startRoundCamera() {
  if(started) return;
  started = true;
  document.addEventListener('toza-round-start', (e: Event) => {
    const d = (e as CustomEvent).detail || {};
    if(featureOn('roundcam') && d.recorder?.tozaSwitchCamera && d.panel?.element) mount(d.recorder, d.panel).catch((): void => undefined);
  });
  window.addEventListener(FEATURES_EVENT, (e: Event) => { const d = (e as CustomEvent).detail; if(d?.k === 'roundcam' && !d.on) document.querySelectorAll('.tz-flip').forEach((el) => el.remove()); });
}
