// Maxfiy chatlar: tanlangan chatlar chatlar ro'yxatidan, qidiruvdan va kontaktlardan yashiriladi; ochish uchun PIN kerak.
// PIN'ning o'zi saqlanmaydi (PBKDF2 xeshi). Faqat shu brauzerda: Telegram'da chat o'zgarmaydi, boshqa qurilmalarda ko'rinadi.
// Ochilgandan keyin Toza 1 daqiqadan ko'p fonda tursa yoki «Qulflash» bosilsa yana yashiriladi.
import {hotReloadGuard, hotReloadGuardReady} from '@lib/solidjs/hotReloadGuardProvider';
import rootScope from '@lib/rootScope';
import {ensureStyle} from './style';
import {icon} from './icons';
import {peerTitle} from './hooks';
import {hashPin, newSalt, pinDelay, validPin} from './extras-core';

type Saved = {salt: string; hash: string; peers: string[]};
const LS = 'toza_hidden', LS_FAIL = 'toza_hidden_fails', RELOCK_MS = 60000;
const read = (): Saved | null => { try { const v = JSON.parse(localStorage.getItem(LS) || 'null'); return v?.hash ? {peers: [], ...v} : null; } catch{ return null; } };
const write = (v: Saved | null) => { try { v ? localStorage.setItem(LS, JSON.stringify(v)) : localStorage.removeItem(LS); } catch{ /* xotira yopiq */ } apply(); };
const fails = (): {n: number; at: number} => { try { return JSON.parse(localStorage.getItem(LS_FAIL) || '{"n":0,"at":0}'); } catch{ return {n: 0, at: 0}; } };
const setFails = (n: number) => { try { localStorage.setItem(LS_FAIL, JSON.stringify({n, at: Date.now()})); } catch{ /* xotira yopiq */ } };

let unlocked = false;
export const hasPin = () => !!read();
export const hiddenPeers = () => read()?.peers || [];
export const isHidden = (peerId: string | number) => hiddenPeers().includes(String(peerId));
export const isUnlocked = () => unlocked || !hasPin();

/** Kutish kerakmi (ketma-ket noto'g'ri PIN): necha soniya qoldi. */
export function waitLeft(): number {
  const f = fails(), d = pinDelay(f.n);
  return d ? Math.max(0, Math.ceil((f.at + d * 1000 - Date.now()) / 1000)) : 0;
}
export async function checkPin(pin: string): Promise<boolean> {
  const s = read();
  if(!s || waitLeft()) return false;
  const ok = (await hashPin(pin, s.salt)) === s.hash;
  setFails(ok ? 0 : fails().n + 1);
  return ok;
}
export async function setPin(pin: string) {
  if(!validPin(pin)) throw new Error('bad_pin');
  const salt = newSalt();
  write({salt, hash: await hashPin(pin, salt), peers: hiddenPeers()});
  unlocked = true; apply();
}
export function setHidden(peerId: string, on: boolean) {
  const s = read();
  if(!s) return;
  const set = new Set(s.peers);
  on ? set.add(String(peerId)) : set.delete(String(peerId));
  write({...s, peers: [...set]});
}
export function lockNow() { unlocked = false; apply(); }
export function unlock() { unlocked = true; apply(); }
/** PIN unutilganda: PIN ham, ro'yxat ham o'chadi (chatlar yana ko'rinadi). */
export function resetAll() { write(null); setFails(0); unlocked = false; }

function apply() {
  let st = document.getElementById('tz-hidden-css') as HTMLStyleElement | null;
  const peers = isUnlocked() ? [] : hiddenPeers();
  if(!peers.length) { st?.remove(); return; }
  if(!st) { st = document.createElement('style'); st.id = 'tz-hidden-css'; document.head.append(st); }
  st.textContent = peers.map((p) => `.chatlist-chat[data-peer-id="${p.replace(/[^\d-]/g, '')}"]`).join(',') + '{display:none!important}';
}

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, any> = {}, ...kids: (Node | string)[]) => {
  const el = document.createElement(tag);
  const {style, ...rest} = props;
  Object.assign(el, rest);
  if(style) el.setAttribute('style', style);
  kids.forEach((k) => el.append(k));
  return el;
};

/** PIN kiritish maydoni + tugma. Muvaffaqiyatda onOk. */
export function pinForm(onOk: () => any, label = 'Ochish'): HTMLElement {
  const inp = h('input', {type: 'password', inputMode: 'numeric', autocomplete: 'off', maxLength: 8, placeholder: 'PIN', style: 'width:100%;box-sizing:border-box;text-align:center;letter-spacing:6px;font-size:20px!important'}) as HTMLInputElement;
  const msg = h('div', {className: 'tz-hint'});
  const go = async() => {
    const left = waitLeft();
    if(left) { msg.textContent = `Ko'p marta noto'g'ri kiritildi. ${left} soniyadan keyin urinib ko'ring.`; return; }
    if(await checkPin(inp.value)) { inp.value = ''; msg.textContent = ''; unlock(); onOk(); return; }
    inp.value = '';
    const w = waitLeft();
    msg.textContent = w ? `PIN noto'g'ri. ${w} soniya kuting.` : 'PIN noto\'g\'ri.';
    msg.style.color = '#d33';
  };
  inp.onkeydown = (e) => { if(e.key === 'Enter') go(); };
  const b = h('button', {type: 'button', className: 'tz-main', style: 'width:100%;margin-top:10px', onclick: go}, label);
  setTimeout(() => inp.focus(), 50);
  return h('div', {}, inp, b, msg);
}

/** Yashirin chat qulflangan holda ochilsa: chatni yopib, PIN so'raymiz; to'g'ri bo'lsa qayta ochamiz. */
function askToOpen(peerId: number) {
  ensureStyle();
  document.querySelector('.tz-back.tz-hidden-ask')?.remove();
  const back = h('div', {className: 'tz-back tz-hidden-ask'});
  const close = () => back.remove();
  back.addEventListener('mousedown', (e) => { if(e.target === back) close(); });
  const pop = h('div', {className: 'tz-pop', style: 'max-width:340px'},
    h('div', {className: 'tz-head', style: 'display:flex;align-items:center;justify-content:space-between;'}, h('b', {}, 'Maxfiy chat'), h('button', {className: 'tz-x', onclick: close}, '✕')),
    h('div', {className: 'tz-hint', style: 'margin-bottom:10px'}, 'Bu chat yashirilgan. Ochish uchun PIN kiriting.'),
    pinForm(() => { close(); (hotReloadGuard as any).appImManager?.setInnerPeer?.({peerId}); }));
  back.append(pop);
  document.body.append(back);
}

let started = false;
export async function startHidden() {
  if(started) return;
  started = true;
  apply();
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if(document.hidden) hiddenAt = Date.now();
    else if(hiddenAt && Date.now() - hiddenAt > RELOCK_MS && unlocked) lockNow();
  });
  try { await hotReloadGuardReady(); } catch{ /* keyinroq */ }
  for(let i = 0; i < 30; i++) {
    const im = hotReloadGuard.appImManager as any;
    if(im?.addEventListener) {
      im.addEventListener('peer_changed', (chat: any) => {
        const peerId = Number(chat?.peerId);
        if(!peerId || isUnlocked() || !isHidden(peerId)) return;
        try { im.setPeer({}); } catch{ /* chat yopilmadi */ }
        askToOpen(peerId);
      });
      return;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

/** Toza sozlamalari → «Maxfiy chatlar» oynasi. */
export function hiddenView(note: (t: string, color?: string) => HTMLElement): HTMLElement {
  const box = h('div');
  const render = () => {
    box.replaceChildren();
    if(!hasPin()) { box.append(...setupView()); return; }
    if(!unlocked) {
      box.append(note('Maxfiy chatlarni ko\'rish va boshqarish uchun PIN kiriting.'), h('div', {className: 'tz-sec', style: 'padding-top:14px'}, pinForm(render)),
        h('div', {className: 'tz-hint', style: 'margin-top:14px'}, 'PIN\'ni unutdingizmi? '),
        resetBtn('PIN va ro\'yxatni o\'chirish'));
      return;
    }
    box.append(...manageView());
  };
  /** Ikki bosqichli tasdiq (Mini App ichida window.confirm ishlamasligi mumkin). */
  const resetBtn = (label: string) => {
    const b = h('button', {type: 'button', style: 'margin-top:10px'}, label) as HTMLButtonElement;
    let armed = false;
    b.onclick = () => {
      if(!armed) { armed = true; b.textContent = 'Rostdanmi? Chatlar yana ko\'rinadi. Yana bosing'; setTimeout(() => { armed = false; b.textContent = label; }, 5000); return; }
      resetAll(); render();
    };
    return b;
  };

  function setupView(): Node[] {
    const a = h('input', {type: 'password', inputMode: 'numeric', maxLength: 8, placeholder: 'Yangi PIN (4–8 raqam)', style: 'width:100%;box-sizing:border-box'}) as HTMLInputElement;
    const b = h('input', {type: 'password', inputMode: 'numeric', maxLength: 8, placeholder: 'PIN\'ni takrorlang', style: 'width:100%;box-sizing:border-box;margin-top:8px'}) as HTMLInputElement;
    const msg = h('div');
    return [
      note('Tanlagan chatlaringiz ro\'yxatdan, qidiruvdan va kontaktlardan yo\'qoladi. Ularni faqat PIN bilan ochasiz. Telegram\'ning o\'zida chat o\'zgarmaydi: telefoningizdagi Telegram\'da ko\'rinaveradi.'),
      h('div', {className: 'tz-sec', style: 'padding-top:14px'}, a, b,
        h('button', {type: 'button', className: 'tz-main', style: 'width:100%;margin-top:10px', onclick: async() => {
          if(!validPin(a.value)) { msg.replaceChildren(note('PIN 4–8 ta raqamdan iborat bo\'lsin.', '#d33')); return; }
          if(a.value !== b.value) { msg.replaceChildren(note('Ikkala PIN bir xil emas.', '#d33')); return; }
          await setPin(a.value); render();
        }}, 'PIN o\'rnatish'), msg)];
  }

  function manageView(): Node[] {
    const listSec = h('div', {className: 'tz-sec'});
    const pick = h('div');
    const q = h('input', {placeholder: 'Chat nomi bo\'yicha qidirish', style: 'width:100%;box-sizing:border-box'}) as HTMLInputElement;
    let all: {id: string; name: string}[] | null = null;
    const loadAll = async() => {
      if(all) return all;
      const mgr = (rootScope as any).managers;
      const ds: any[] = await mgr.dialogsStorage.getCachedDialogs(true).catch((): any[] => []) || [];
      const ids = [...new Set(ds.map((d) => String(d?.peerId)).filter((x) => x && x !== 'undefined' && x !== String(rootScope.myId)))].slice(0, 600);
      all = await Promise.all(ids.map(async(id) => ({id, name: await peerTitle(id)})));
      return all;
    };
    const paintList = async() => {
      const peers = hiddenPeers();
      listSec.replaceChildren(h('b', {}, `Yashirilgan chatlar (${peers.length})`));
      if(!peers.length) listSec.append(h('div', {className: 'tz-hint'}, 'Hozircha yo\'q. Pastdan chat qidirib «Yashirish»ni bosing.'));
      for(const id of peers) {
        listSec.append(h('div', {className: 'tz-row'}, h('span', {className: 'tz-ic tz-soft'}, icon('ghost')), h('div', {className: 'tz-tx'}, await peerTitle(id)),
          h('div', {style: 'display:flex;gap:6px;flex:none'},
            h('button', {type: 'button', onclick: () => { document.querySelector('.tz-back')?.remove(); (hotReloadGuard as any).appImManager?.setInnerPeer?.({peerId: Number(id)}); }}, 'Ochish'),
            h('button', {type: 'button', onclick: () => { setHidden(id, false); paintList(); paintPick(); }}, 'Ko\'rsatish'))));
      }
    };
    const paintPick = async() => {
      const s = q.value.trim().toLocaleLowerCase();
      if(!s) { pick.replaceChildren(h('div', {className: 'tz-hint'}, 'Chat nomini yozing.')); return; }
      pick.replaceChildren(h('div', {className: 'tz-hint'}, 'Qidirilmoqda…'));
      const found = (await loadAll()).filter((c) => c.name.toLocaleLowerCase().includes(s) && !isHidden(c.id)).slice(0, 20);
      pick.replaceChildren(...(found.length ? found.map((c) => h('div', {className: 'tz-row'}, h('div', {className: 'tz-tx'}, c.name),
        h('button', {type: 'button', className: 'tz-main', onclick: () => { setHidden(c.id, true); paintList(); paintPick(); }}, 'Yashirish'))) : [h('div', {className: 'tz-hint'}, 'Topilmadi.')]));
    };
    q.oninput = () => { clearTimeout((q as any).t); (q as any).t = setTimeout(paintPick, 200); };
    paintList(); paintPick();
    const newPin = h('input', {type: 'password', inputMode: 'numeric', maxLength: 8, placeholder: 'Yangi PIN', style: 'flex:1;min-width:0'}) as HTMLInputElement;
    const pinMsg = h('div');
    return [
      h('div', {className: 'tz-sec', style: 'padding-top:12px'}, h('div', {className: 'tz-row'}, h('span', {className: 'tz-ic'}, icon('eye')),
        h('div', {className: 'tz-tx'}, 'Hozir ochiq', h('div', {className: 'tz-sub'}, 'Yashirilgan chatlar ro\'yxatda ko\'rinib turibdi. Toza 1 daqiqadan ko\'p fonda tursa o\'zi qulflanadi.')),
        h('button', {type: 'button', className: 'tz-main', onclick: () => { lockNow(); render(); }}, 'Qulflash'))),
      listSec,
      h('div', {className: 'tz-sec'}, h('b', {}, 'Chat qo\'shish'), q, pick),
      h('div', {className: 'tz-sec'}, h('b', {}, 'PIN'),
        h('div', {style: 'display:flex;gap:8px'}, newPin, h('button', {type: 'button', onclick: async() => {
          if(!validPin(newPin.value)) { pinMsg.replaceChildren(note('PIN 4–8 ta raqam.', '#d33')); return; }
          await setPin(newPin.value); newPin.value = ''; pinMsg.replaceChildren(note('PIN almashtirildi.', '#2a9d4b'));
        }}, 'Almashtirish')), pinMsg,
        h('div', {className: 'tz-hint'}, 'Maxfiy chatdan bildirishnoma kelmasin desangiz, chatni Telegram\'da ovozsiz qiling.'),
        resetBtn('Maxfiy chatlarni o\'chirish'))
    ];
  }
  render();
  return box;
}
