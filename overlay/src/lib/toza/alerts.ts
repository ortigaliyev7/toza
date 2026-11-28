// Tahrirlangan va o'chirilgan xabarlar haqida joyida xabar (obunada): Toza ochiq bo'lganda ekranda va (ruxsat berilgan bo'lsa) tizim bildirishnomasi.
// Toza yopiq bo'lsa ishlamaydi: Telegram sessiyasi faqat shu brauzerda, serverga berilmaydi (zaxira nol bilim).

export type Alert = {kind: 'deleted' | 'edited'; who: string; text: string; old?: string};

const LS = 'toza_alerts';
export const alertsOn = () => localStorage.getItem(LS) !== '0';
export const setAlertsOn = (on: boolean) => localStorage.setItem(LS, on ? '1' : '0');

const cut = (s: string, n = 110) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
export const describe = (a: Alert) => a.kind === 'deleted' ? `O'chirdi: «${cut(a.text)}»` : `Tahrirladi: «${cut(a.old || '')}» → «${cut(a.text)}»`;

let queue: Alert[] = [];
let timer: number | undefined;
let box: HTMLElement | null = null;
let onOpen: (() => void) | null = null;

function toast(title: string, body: string) {
  if(!box) {
    box = document.createElement('div');
    box.className = 'tz-toasts';
    box.setAttribute('style', 'position:fixed;left:12px;bottom:12px;z-index:99999;display:flex;flex-direction:column;gap:8px;max-width:min(360px,calc(100vw - 24px));');
    document.body.append(box);
  }
  const el = document.createElement('div');
  el.setAttribute('style', 'background:var(--surface-color,#fff);color:var(--primary-text-color,#000);border-radius:14px;padding:10px 12px;box-shadow:0 6px 24px rgba(0,0,0,.3);cursor:pointer;font-size:14px;line-height:1.35;border-left:4px solid #e8860c;');
  const b = document.createElement('b'); b.textContent = title;
  const d = document.createElement('div'); d.textContent = body; d.setAttribute('style', 'opacity:.85;word-break:break-word;');
  el.append(b, d);
  el.onclick = () => { el.remove(); onOpen?.(); };
  box.append(el);
  while(box.children.length > 3) box.firstElementChild!.remove();
  setTimeout(() => el.remove(), 9000);
}

function system(title: string, body: string) {
  try {
    if(document.hidden && typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification(title, {body, tag: 'toza-alert'});
  } catch{ /* ruxsat yo'q yoki qo'llab-quvvatlanmaydi */ }
}

export function setAlertOpener(fn: () => void) { onOpen = fn; }

/** Bir zumda ko'p hodisa kelsa (masalan Toza yopiq paytdagi o'zgarishlar) bittaga jamlanadi. */
export function pushAlert(a: Alert) {
  queue.push(a);
  clearTimeout(timer);
  timer = window.setTimeout(() => {
    const list = queue.splice(0, queue.length);
    if(!list.length) return;
    if(list.length <= 3) list.forEach((x) => { toast(x.who, describe(x)); system(x.who, describe(x)); });
    else {
      const del = list.filter((x) => x.kind === 'deleted').length, ed = list.length - del;
      const body = [del ? `${del} ta xabar o'chirildi` : '', ed ? `${ed} ta xabar tahrirlandi` : ''].filter(Boolean).join(', ');
      toast('Toza', body); system('Toza', body);
    }
  }, 1200);
}

/** Oddiy bir martalik xabar (masalan, «Toza yopiq edi»). */
export function notice(title: string, body: string) { toast(title, body); system(title, body); }

export function fmtDuration(ms: number) {
  const m = Math.round(ms / 60000);
  if(m < 60) return `${m} daqiqa`;
  const h = Math.floor(m / 60);
  return h < 48 ? `${h} soat${m % 60 ? ' ' + (m % 60) + ' daqiqa' : ''}` : `${Math.round(h / 24)} kun`;
}
