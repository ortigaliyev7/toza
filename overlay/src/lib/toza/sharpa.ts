// Sharpa bo'limlari Toza ichida: Bozor va Profil (Sharpa Mini App). Sharpa akkauntiga ulangan zaxira kerak: server qurilma tokenini beradi,
// u faqat shu brauzerda saqlanadi. Sharpa Telegram sessiyangizni ko'rmaydi: Toza faqat Sharpa sahifasini ochadi.
import {forgetSharpa, sharpaAccess, startTozaBackup} from './hooks';
import {TozaApiError} from './core';

const TABS: [string, string][] = [['bozor', 'Bozor'], ['profil', 'Profil'], ['laqab', 'Maxsus nom'], ['vositalar', 'Vositalar']];

const errText = (e: any): string => {
  if(e?.message === 'bot_timeout') return 'Sharpa boti javob bermadi. Telegram\'da Sharpa botini (@sharpa_robot) oching va /start bosing, so\'ng qayta urinib ko\'ring.';
  if(e?.message === 'no_bot') return 'Sharpa boti topilmadi.';
  if(e?.message === 'no_server' || (e instanceof TozaApiError && e.code === 'no_url')) return 'Sharpa serveri sozlanmagan (admin: Toza servisida VITE_TB_URL va botda WEBAPP_URL).';
  if(e instanceof TozaApiError && e.code === 'rate') return 'Juda ko\'p urinish. Birozdan keyin qayta urinib ko\'ring.';
  if(e instanceof TozaApiError && e.code === 'none') return 'Kirish kodi eskirdi. Qayta urinib ko\'ring.';
  return 'Xato: ' + (e instanceof TozaApiError ? e.status + ' ' + e.code : e?.message || e);
};

export function sharpaUrl(base: string, k: string, tab: string) {
  return `${base.replace(/\/+$/, '')}/?k=${encodeURIComponent(k)}#/${tab}`;
}

export async function openSharpa(tab = 'bozor') {
  startTozaBackup();
  const back = document.createElement('div');
  back.setAttribute('style', 'position:fixed;inset:0;z-index:9998;background:var(--surface-color,#fff);display:flex;flex-direction:column;');
  const bar = document.createElement('div');
  bar.setAttribute('style', 'display:flex;gap:6px;align-items:center;padding:8px 10px;border-bottom:1px solid rgba(127,127,127,.25);overflow:auto;flex:none;');
  const body = document.createElement('div');
  body.setAttribute('style', 'flex:1;min-height:0;position:relative;');
  back.append(bar, body);
  document.body.append(back);
  const close = () => back.remove();

  const mkBtn = (text: string, on: boolean, fn: () => void) => {
    const b = document.createElement('button');
    b.textContent = text;
    b.setAttribute('style', `border:0;border-radius:99px;padding:8px 14px;font:inherit;font-weight:600;cursor:pointer;flex:none;background:${on ? 'var(--primary-color,#3390ec)' : 'rgba(127,127,127,.18)'};color:${on ? '#fff' : 'inherit'};`);
    b.onclick = fn;
    return b;
  };
  const message = (t: string) => {
    const d = document.createElement('div');
    d.setAttribute('style', 'padding:20px;line-height:1.45;');
    d.textContent = t;
    body.replaceChildren(d);
  };

  let access: {k: string; url: string} | null = null;
  const field = (ph: string) => { const i = document.createElement('input'); i.placeholder = ph; i.setAttribute('style', 'width:100%;box-sizing:border-box;padding:10px;border-radius:10px;border:1px solid rgba(127,127,127,.4);background:transparent;color:inherit;font:inherit;letter-spacing:1px;margin:6px 0;'); return i; };
  const bigBtn = (t: string, fn: () => void, primary = true) => { const b = mkBtn(t, primary, fn); b.style.margin = '4px 6px 4px 0'; return b; };
  const retry = () => { const box = document.createElement('div'); box.setAttribute('style', 'padding:0 20px 20px;'); box.append(bigBtn('Qayta urinish', () => { openSharpa(tab); close(); })); body.append(box); };
  const render = (active: string) => {
    bar.replaceChildren(...TABS.map(([id, label]) => mkBtn(label, id === active, () => render(id))), Object.assign(mkBtn('Yopish', false, close), {style: 'margin-inline-start:auto;border:0;border-radius:99px;padding:8px 14px;font:inherit;font-weight:600;cursor:pointer;flex:none;background:rgba(127,127,127,.18);color:inherit;'}));
    if(!access) return;
    const f = document.createElement('iframe');
    f.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;border:0;');
    f.setAttribute('allow', 'clipboard-read; clipboard-write; fullscreen');
    f.src = sharpaUrl(access.url, access.k, active);
    body.replaceChildren(f);
  };

  render(tab);
  message('Yuklanmoqda…');
  try {
    message('Sharpa\'ga kirilmoqda… (botga qisqa xabar yuboriladi)');
    access = await sharpaAccess();
  } catch(e) {
    message(errText(e));
    retry();
    return;
  }
  render(tab);
  // Token Sharpa'da bekor qilingan bo'lsa (qurilmalar uzilgan): qayta olishga urinamiz
  window.addEventListener('message', async function onMsg(ev: MessageEvent) {
    if(!access || ev.origin !== new URL(access.url).origin || ev.data?.t !== 'sharpa-auth-failed') return;
    window.removeEventListener('message', onMsg);
    forgetSharpa();
    try { access = await sharpaAccess(true); render(tab); } catch(e) { message(errText(e)); }
  });
}
