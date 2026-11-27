// Belgilash rejimidagi tezkor qator: chatlar ro'yxatida yoki kontaktlarda bosib turib belgilash boshlanganda
// tweb'ning belgilash paneli ostida toifa tugmalari chiqadi («O'qilmagan», «Uzoq ochilmagan», «Kanallar»…).
// Tugma bosilsa o'sha toifadagilar birdaniga belgilanadi, «O'chirish» tweb'ning o'z tasdig'i bilan o'chiradi/chiqadi.
// tweb tomoni: patches/0003-toza-selection.patch (`toza-selection` hodisasi, tozaSelectOnly, tozaDelete).
import rootScope from '@lib/rootScope';
import {ensureStyle} from './style';
import {icon} from './icons';
import {notice} from './alerts';
import {matchChat, matchContact} from './tools-core';
import type {ChatFilter, ChatInfo, ContactFilter, ContactInfo} from './tools-core';
import {openedMap, trackSince} from './opened';
import {loadContacts} from './contacts';
import {featureOn, FEATURES_EVENT} from './features';

type Sel = {tozaListKeys(): number[]; tozaSelectOnly(keys: number[]): void; tozaDelete(): Promise<void>; cancelSelection(): void; addEventListener(e: 'toggle', cb: (on: boolean) => void): void; removeEventListener(e: 'toggle', cb: (on: boolean) => void): void; isSelecting: boolean};

const CHAT_CHIPS: [ChatFilter, string][] = [
  ['all', 'Hammasi'], ['unread', 'O\'qilmagan'], ['notOpened', 'Uzoq ochilmagan'], ['unreadMany', '50+ o\'qilmagan'], ['silent', '1 oy jim'],
  ['channels', 'Kanallar'], ['groups', 'Guruhlar'], ['private', 'Shaxsiy'], ['bots', 'Botlar'], ['deleted', 'O\'chirilgan akkaunt'], ['muted', 'Ovozsiz']
];
const CONTACT_CHIPS: [ContactFilter, string][] = [
  ['all', 'Hammasi'], ['inactiveMonth', '1 oydan beri kirmagan'], ['inactiveWeek', '1 haftadan beri'], ['deleted', 'O\'chirilgan akkaunt'], ['noChat', 'Chat yo\'q'], ['noPhone', 'Raqamsiz']
];
const muted = (s: any) => s?._ === 'peerNotifySettings' && (!!s.silent || (s.mute_until !== undefined && s.mute_until * 1000 > Date.now()));

async function chatInfos(keys: number[], cache: Map<number, ChatInfo | null>): Promise<Map<number, ChatInfo | null>> {
  const mgr = (rootScope as any).managers, opened = openedMap();
  await Promise.all(keys.filter((k) => !cache.has(k)).map(async(peerId) => {
    try {
      const d = await mgr.appMessagesManager.getDialogOnly(peerId);
      if(!d) { cache.set(peerId, null); return; }
      let kind: ChatInfo['kind'] = 'user', deleted = false, name = '';
      if(peerId > 0) {
        const u = await mgr.appUsersManager.getUser(peerId);
        kind = u?.pFlags?.bot ? 'bot' : 'user'; deleted = !!u?.pFlags?.deleted; name = u?.first_name || '';
      } else {
        const c = await mgr.appChatsManager.getChat(-peerId);
        kind = c?._ === 'channel' && !c.pFlags?.megagroup ? 'channel' : 'group'; name = c?.title || '';
      }
      const top = d.top_message ? await mgr.appMessagesManager.getMessageByPeer(peerId, d.top_message).catch((): any => undefined) : undefined;
      cache.set(peerId, {id: String(peerId), name, kind, deleted, unread: d.unread_count || (d.pFlags?.unread_mark ? 1 : 0), lastMsg: top?.date || 0, muted: muted(d.notify_settings), archived: d.folder_id === 1, opened: opened[String(peerId)]});
    } catch{ cache.set(peerId, null); }
  }));
  return cache;
}

function mount(sel: Sel, plate: HTMLElement, header: HTMLElement, kind: string) {
  const isChats = kind === 'ChatsSelected', isContacts = kind === 'ContactsSelected';
  if(!isChats && !isContacts) return;                                   // mavzular (forum) uchun emas
  if(!featureOn('selbar')) return;
  ensureStyle();
  const strip = document.createElement('div');
  strip.className = 'tz-selbar';
  strip.setAttribute('role', 'toolbar');
  strip.setAttribute('aria-label', 'Toifa bo\'yicha belgilash');
  strip.style.top = `${header.offsetHeight || 56}px`;
  const row = document.createElement('div'); row.className = 'tz-selbar-row';
  strip.append(row);

  const now = Math.floor(Date.now() / 1000), since = trackSince();
  const chatCache = new Map<number, ChatInfo | null>();
  let contacts: Map<number, ContactInfo> | null = null;
  let active = '';

  const pick = async(f: string, label: string, b: HTMLButtonElement) => {
    const keys = sel.tozaListKeys();
    b.classList.add('busy');
    let want: number[] = [];
    try {
      if(isChats) {
        const info = await chatInfos(keys, chatCache);
        want = keys.filter((k) => { const c = info.get(k); return c && matchChat(c, f as ChatFilter, now, since); });
      } else {
        contacts ||= new Map((await loadContacts()).map((c) => [Number(c.id), c]));
        want = keys.filter((k) => { const c = contacts.get(k); return c && matchContact(c, f as ContactFilter, now); });
      }
    } finally { b.classList.remove('busy'); }
    if(!sel.isSelecting) return;
    if(!want.length) { notice('Toza', `«${label}» toifasida hech narsa yo'q.`); return; }
    active = f;
    sel.tozaSelectOnly(want);
    paint();
  };

  const chips = (isChats ? CHAT_CHIPS : CONTACT_CHIPS) as [string, string][];
  for(const [f, label] of chips) {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.f = f; b.textContent = label;
    b.onclick = () => pick(f, label, b);
    row.append(b);
  }
  const del = document.createElement('button'); del.type = 'button'; del.className = 'tz-selbar-del';
  del.append(icon('trash', 16), document.createTextNode('O\'chirish'));
  del.title = isChats ? 'Belgilangan chatlarni o\'chirish (kanal va guruhlardan chiqiladi)' : 'Belgilangan kontaktlarni o\'chirish';
  del.onclick = () => { sel.tozaDelete().catch((): void => undefined); };
  strip.append(del);
  const paint = () => row.querySelectorAll<HTMLElement>('[data-f]').forEach((b) => { const on = b.dataset.f === active; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  paint();

  plate.after(strip);
  requestAnimationFrame(() => strip.classList.add('in'));
  const onToggle = (on: boolean) => {
    if(on) return;
    sel.removeEventListener('toggle', onToggle);
    strip.classList.remove('in');
    setTimeout(() => strip.remove(), 200);
  };
  sel.addEventListener('toggle', onToggle);
}

let started = false;
export function startSelectionBar() {
  if(started) return;
  started = true;
  document.addEventListener('toza-selection', (e: Event) => {
    const d = (e as CustomEvent).detail || {};
    try { if(d.selection?.tozaSelectOnly && d.plate && d.header) mount(d.selection, d.plate, d.header, d.kind); } catch{ /* tweb o'zgargan bo'lsa jim */ }
  });
  window.addEventListener(FEATURES_EVENT, (e: Event) => { const d = (e as CustomEvent).detail; if(d?.k === 'selbar' && !d.on) document.querySelectorAll('.tz-selbar').forEach((el) => el.remove()); });
}
