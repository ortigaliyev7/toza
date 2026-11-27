// Telefondagi Telegram ko'rinishi (faqat tor ekranda, chatlar ro'yxati sahifasida):
//  - pastki panel: Chatlar · Kontaktlar · Sozlamalar · Profil (Chatlar ustida o'qilmaganlar soni);
//  - «Profil» — rangli muqovali o'z profil sahifasi (Rasm belgilash, Tahrirlash, Sozlamalar; ⋮ menyu);
//  - «Profil»ni bosib turish — akkauntlar ro'yxati va «Hisob qo'shish».
// tweb'ning o'z oynalari (sozlamalar, kontaktlar, profilni tahrirlash) ochiladi, Toza faqat yo'l ko'rsatadi.
import rootScope from '@lib/rootScope';
import {hotReloadGuard} from '@lib/solidjs/hotReloadGuardProvider';
import {getMiddleware} from '@helpers/middleware';
import AccountController from '@lib/accounts/accountController';
import {getCurrentAccount} from '@lib/accounts/getCurrentAccount';
import {createProxiedManagersForAccount} from '@lib/getProxiedManagers';
import {ensureStyle} from './style';
import {icon} from './icons';
import {featureOn, FEATURES_EVENT} from './features';
import {profileDesignView} from './design';

const g = () => hotReloadGuard as any;
const h = (tag: string, cls = '', ...kids: (Node | string)[]) => { const el = document.createElement(tag); if(cls) el.className = cls; kids.forEach((k) => el.append(k)); return el; };
const hex = (n: number) => '#' + (n >>> 0).toString(16).padStart(6, '0').slice(-6);
const night = () => document.documentElement.classList.contains('night');
const userName = (u: any) => [u?.first_name, u?.last_name].filter(Boolean).join(' ') || 'Akkaunt';

// ---------------------------------------------------------------- tweb oynalarini ochish
async function openTab(name: 'AppSettingsTab' | 'AppContactsTab' | 'AppEditProfileTab') {
  closeProfile();
  const sb = g().appSidebarLeft, tabs = g().tabs;
  if(!sb || !tabs?.[name]) return;
  if(sb.closeEverythingInside?.()) await new Promise((r) => setTimeout(r, 200));
  const tab = sb.createTab(tabs[name]);
  name === 'AppEditProfileTab' ? tab.open(tabs.getEditProfileInitArgs(true)) : tab.open();
}

function avatar(peerId: any, size: number, accountNumber?: number): HTMLElement {
  const mw = getMiddleware();
  try {
    const a = g().avatarNew({middleware: mw.get(), size, peerId, isBig: size > 60, accountNumber});
    a.render?.();
    const node = a.node as HTMLElement;
    const stop = new MutationObserver(() => { if(!node.isConnected && wasIn) { mw.destroy(); stop.disconnect(); } });
    let wasIn = false;
    requestAnimationFrame(() => { wasIn = node.isConnected; stop.observe(document.body, {childList: true, subtree: true}); });
    return node;
  } catch{ return h('div', 'tz-mp-avph', '?'); }
}

// ---------------------------------------------------------------- profil sahifasi
let page: HTMLElement | null = null;
function closeProfile() { page?.remove(); page = null; bar?.querySelectorAll('[data-t]').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.t === 'chats')); }

async function coverBg(user: any): Promise<string> {
  const id = user?.profile_color?.color;
  if(id === undefined) return 'var(--primary-color)';
  try {
    const res = await (rootScope as any).managers.apiManager.getPeerProfileColors();
    const o = res?.colors?.find((x: any) => x.color_id === id);
    const set = (night() && o?.dark_colors) || o?.colors;
    const bg: number[] = set?.bg_colors || [];
    return bg.length ? `linear-gradient(180deg, ${bg.map(hex).join(', ')})` : 'var(--primary-color)';
  } catch{ return 'var(--primary-color)'; }
}

async function openProfile(host: HTMLElement) {
  if(page) return;
  ensureStyle();
  const mgr = (rootScope as any).managers, myId = rootScope.myId;
  bar?.querySelectorAll('[data-t]').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.t === 'profile'));
  page = h('div', 'tz-mp');
  page.setAttribute('role', 'dialog'); page.setAttribute('aria-label', 'Profil');
  host.append(page);
  const p = page;
  const [user, full] = await Promise.all([mgr.appUsersManager.getSelf(), mgr.appProfileManager.getProfile(myId).catch((): any => null)]);
  if(page !== p) return;

  const cover = h('div', 'tz-mp-cover');
  cover.style.background = await coverBg(user);
  const qr = h('button', 'tz-mp-round', icon('qr', 22)) as HTMLButtonElement; qr.type = 'button'; qr.setAttribute('aria-label', 'QR kod');
  qr.onclick = () => { try { g().showMyQrCodePopup?.(); } catch{ /* yo'q */ } };
  const more = h('button', 'tz-mp-round tz-mp-more', icon('more', 22)) as HTMLButtonElement; more.type = 'button'; more.setAttribute('aria-label', 'Yana');
  more.onclick = (e) => { e.stopPropagation(); moreMenu(p, user); };
  const name = h('div', 'tz-mp-name', userName(user)); name.dir = 'auto';
  const status = h('div', 'tz-mp-status', 'onlayn');
  const btn = (ic: string, label: string, fn: () => any) => { const b = h('button', 'tz-mp-act', icon(ic, 24), h('span', '', label)) as HTMLButtonElement; b.type = 'button'; b.onclick = fn; return b; };
  const acts = h('div', 'tz-mp-acts',
    btn('camera', 'Rasm belgilash', () => openTab('AppEditProfileTab')),
    btn('edit', 'Tahrirlash', () => openTab('AppEditProfileTab')),
    btn('gear', 'Sozlamalar', () => openTab('AppSettingsTab')));
  cover.append(h('div', 'tz-mp-top', qr, more), avatar(myId, 110), name, status, acts);

  const info = h('div', 'tz-mp-card');
  const line = (val: string, label: string, ltr = false) => { const v = h('div', 'tz-mp-val', val); v.dir = ltr ? 'ltr' : 'auto'; info.append(h('div', 'tz-mp-line', v, h('div', 'tz-mp-lab', label))); };
  if(user?.phone) line('+' + user.phone, 'Mobil raqam', true);
  if(full?.about) line(full.about, 'Tarjimayi hol');
  const uname = user?.username || user?.usernames?.find((u: any) => u.pFlags?.active)?.username;
  if(uname) line('@' + uname, 'Foydalanuvchi nomi', true);
  const bd = full?.birthday;
  if(bd?.day) {
    const months = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
    let s = `${bd.day} ${months[bd.month - 1]}`;
    if(bd.year) { const now = new Date(); let age = now.getFullYear() - bd.year; if(now.getMonth() + 1 < bd.month || (now.getMonth() + 1 === bd.month && now.getDate() < bd.day)) age--; s += `, ${bd.year} (${age} yosh)`; }
    line(s, 'Tug\'ilgan kun');
  }
  const kids: Node[] = [cover];
  if(full?.personal_channel_id) {
    try {
      const ch = await mgr.appChatsManager.getChat(full.personal_channel_id);
      const card = h('button', 'tz-mp-card tz-mp-chan') as HTMLButtonElement; card.type = 'button';
      card.append(h('div', 'tz-mp-lab', 'Kanal' + (ch?.participants_count ? ` · ${ch.participants_count} obunachi` : '')), h('div', 'tz-mp-val', ch?.title || 'Kanal'));
      card.onclick = () => { closeProfile(); g().appImManager?.setInnerPeer?.({peerId: (-full.personal_channel_id) as any}); };
      kids.push(card);
    } catch{ /* kanal topilmadi */ }
  }
  if(info.childElementCount) kids.push(info);
  p.replaceChildren(...kids);
}

function moreMenu(p: HTMLElement, user: any) {
  p.querySelector('.tz-mp-menu')?.remove();
  const m = h('div', 'tz-mp-menu'); m.setAttribute('role', 'menu');
  const item = (ic: string, label: string, fn: () => any) => { const b = h('button', '', icon(ic, 20), h('span', '', label)) as HTMLButtonElement; b.type = 'button'; b.setAttribute('role', 'menuitem'); b.onclick = () => { m.remove(); fn(); }; m.append(b); };
  item('palette', 'Profil rangini o\'zgartirish', () => openDesign(p));
  item('at', 'Foydalanuvchi nomini o\'zgartirish', () => openTab('AppEditProfileTab'));
  const uname = user?.username || user?.usernames?.find((u: any) => u.pFlags?.active)?.username;
  if(uname) item('link', 'Profilga havoladan nusxa olish', async() => { try { await navigator.clipboard.writeText('https://t.me/' + uname); g().toast?.('Havola nusxalandi'); } catch{ /* ruxsat yo'q */ } });
  p.append(m);
  const off = (e: Event) => { if(!m.contains(e.target as Node)) { m.remove(); document.removeEventListener('pointerdown', off, true); } };
  setTimeout(() => document.addEventListener('pointerdown', off, true));
}

async function openDesign(p: HTMLElement) {
  const box = h('div', 'tz-mp-design');
  const back = h('button', 'tz-mp-round', icon('back', 22)) as HTMLButtonElement; back.type = 'button'; back.setAttribute('aria-label', 'Orqaga');
  back.onclick = () => { box.remove(); const host = p.parentElement; closeProfile(); if(host) openProfile(host); };
  box.append(h('div', 'tz-mp-top', back), h('div', 'tz-sub', 'Yuklanmoqda…'));
  p.append(box);
  const note = (t: string, color = '') => { const d = h('div', 'tz-sub', t); if(color) d.style.color = color; return d; };
  try { box.replaceChildren(h('div', 'tz-mp-top', back), await profileDesignView(note, {avatar: () => avatar(rootScope.myId, 96)})); } catch{ box.lastElementChild?.replaceWith(note('Ochib bo\'lmadi.')); }
}

// ---------------------------------------------------------------- akkauntlar (Profil'ni bosib turish)
async function accountMenu(anchor: HTMLElement) {
  document.querySelector('.tz-acc')?.remove();
  ensureStyle();
  const m = h('div', 'tz-acc'); m.setAttribute('role', 'menu');
  const add = h('button', 'tz-acc-add', icon('plus', 22), h('span', '', 'Hisob qo\'shish')) as HTMLButtonElement; add.type = 'button';
  add.onclick = (e) => { m.remove(); g().appSidebarLeft?.addAccount?.(e); };
  m.append(add);
  const cur = getCurrentAccount();
  try {
    for(const n of await AccountController.getAccountNumbers()) {
      const data: any = await AccountController.get(n);
      const peerId = data?.userId !== undefined ? (data.userId as any).toPeerId?.() ?? Number(data.userId) : undefined;
      let nm = '';
      try { nm = userName(n === cur ? await (rootScope as any).managers.appUsersManager.getSelf() : await createProxiedManagersForAccount(n).appUsersManager.getSelf()); } catch{ nm = 'Akkaunt ' + n; }
      const b = h('button', 'tz-acc-item' + (n === cur ? ' on' : ''), avatar(peerId, 40, n), h('span', '', nm)) as HTMLButtonElement;
      b.type = 'button'; b.setAttribute('role', 'menuitem');
      b.onclick = () => { m.remove(); if(n !== cur) g().switchAccount?.(n); else openTab('AppSettingsTab'); };
      m.append(b);
    }
  } catch{ /* akkauntlar ro'yxati yo'q */ }
  const r = anchor.getBoundingClientRect();
  m.style.bottom = `${window.innerHeight - r.top + 8}px`;
  m.style.right = `${Math.max(8, window.innerWidth - r.right)}px`;
  document.body.append(m);
  const off = (e: Event) => { if(!m.contains(e.target as Node)) { m.remove(); document.removeEventListener('pointerdown', off, true); } };
  setTimeout(() => document.addEventListener('pointerdown', off, true));
}

// ---------------------------------------------------------------- pastki panel
let bar: HTMLElement | null = null;
async function unread(badge: HTMLElement) {
  try {
    const c = await (rootScope as any).managers.dialogsStorage.getFolderUnreadCount(0);
    const n = c?.unreadUnmutedCount ?? 0;
    badge.textContent = n > 99 ? '99+' : String(n);
    badge.hidden = !n;
  } catch{ badge.hidden = true; }
}

function mountBar() {
  const host = document.querySelector<HTMLElement>('#column-left .item-main');
  if(!host || bar?.isConnected) return;
  ensureStyle();
  bar = h('nav', 'tz-tabbar'); bar.setAttribute('aria-label', 'Asosiy bo\'limlar');
  const badge = h('span', 'tz-tabbar-badge'); badge.hidden = true;
  const tab = (t: string, ic: Node, label: string, fn: (b: HTMLButtonElement) => any) => {
    const b = h('button', 'tz-tabbar-btn' + (t === 'chats' ? ' on' : ''), ic, h('span', '', label)) as HTMLButtonElement;
    b.type = 'button'; b.dataset.t = t; b.onclick = () => fn(b);
    bar!.append(b);
    return b;
  };
  const chatsIc = h('span', 'tz-tabbar-ic', icon('chat', 24), badge);
  tab('chats', chatsIc, 'Chatlar', () => {
    if(page) return;
    document.querySelector<HTMLElement>('#folders-container .tabs-tab.active .scrollable, #folders-container .scrollable')?.scrollTo({top: 0, behavior: 'smooth'});
  });
  tab('contacts', icon('contact', 24), 'Kontaktlar', () => openTab('AppContactsTab'));
  tab('settings', icon('gear', 24), 'Sozlamalar', () => openTab('AppSettingsTab'));
  const me = h('span', 'tz-tabbar-ic');
  me.append(avatar(rootScope.myId, 26));
  const prof = tab('profile', me, 'Profil', () => {
    if(held) { held = false; return; }
    openProfile(host);
  });
  // bosib turish: akkauntlar
  let timer = 0, held = false;
  prof.addEventListener('pointerdown', () => { held = false; timer = window.setTimeout(() => { held = true; try { navigator.vibrate?.(15); } catch{ /* yo'q */ } accountMenu(prof); }, 450); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => prof.addEventListener(ev, () => clearTimeout(timer)));
  prof.addEventListener('contextmenu', (e) => e.preventDefault());
  host.append(bar);
  document.documentElement.classList.add('tz-tabbar-on');
  unread(badge);
  rootScope.addEventListener('folder_unread' as any, (f: any) => { if(f?.id === 0) unread(badge); });
}

function unmountBar() {
  closeProfile();
  bar?.remove(); bar = null;
  document.documentElement.classList.remove('tz-tabbar-on');
}

let started = false;
export function startMobileNav() {
  if(started) return;
  started = true;
  const apply = () => { if(featureOn('tabbar')) mountBar(); else unmountBar(); };
  // chatlar ro'yxati tayyor bo'lganda (bir necha urinish)
  let n = 0; const t = window.setInterval(() => { apply(); if(bar || ++n > 30) clearInterval(t); }, 1000);
  window.addEventListener(FEATURES_EVENT, (e: Event) => { if((e as CustomEvent).detail?.k === 'tabbar') apply(); });
  // akkaunt almashganda avatar yangilansin
  rootScope.addEventListener('account_switched' as any, () => { unmountBar(); setTimeout(apply, 1500); });
}
