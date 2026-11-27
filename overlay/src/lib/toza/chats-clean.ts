// Kanal va guruhlarni tozalash: uzoq ochilmagan, ko'p o'qilmagan, jim qolgan, ovozsiz yoki arxivdagilarni saralab,
// tez belgilab (kontaktlardagi kabi) tasdiq bilan birdaniga chiqib ketish.
import rootScope from '@lib/rootScope';
import {openCleaner} from './cleaner';
import {agoText, matchChat, sortChats} from './tools-core';
import type {ChatFilter, ChatInfo} from './tools-core';
import {openedMap, trackSince} from './opened';

const FILTERS: [ChatFilter, string][] = [
  ['notOpened', 'Uzoq ochilmagan'], ['unreadMany', '50+ o\'qilmagan'], ['unread', 'O\'qilmagan'], ['silent', '1 oydan beri jim'],
  ['muted', 'Ovozsiz'], ['archived', 'Arxivda'], ['channels', 'Kanallar'], ['groups', 'Guruhlar'], ['all', 'Hammasi']
];
type Sort = 'unread' | 'opened' | 'active' | 'name';
const PAGE = 100, MAX_PAGES = 30, LEAVE_GAP_MS = 400;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const muted = (s: any) => s?._ === 'peerNotifySettings' && (!!s.silent || (s.mute_until !== undefined && s.mute_until * 1000 > Date.now()));

/** Ikkala papkadagi (asosiy va arxiv) barcha dialoglarni yuklab, kanal va guruhlarni ajratadi. */
async function loadChats(): Promise<ChatInfo[]> {
  const mgr = (rootScope as any).managers;
  for(const filterId of [0, 1]) {
    let offsetIndex: number | undefined;
    for(let p = 0; p < MAX_PAGES; p++) {
      const r = await mgr.dialogsStorage.getDialogs({filterId, offsetIndex, limit: PAGE});
      const ds: any[] = r?.dialogs || [];
      if(r?.isEnd || !ds.length) break;
      const idx = Math.min(...ds.map((d) => d[`index_${filterId}`] ?? d.index ?? Infinity));
      if(!isFinite(idx) || idx === offsetIndex) break;
      offsetIndex = idx;
    }
  }
  const dialogs: any[] = await mgr.dialogsStorage.getCachedDialogs(true) || [];
  const opened = openedMap();
  const out: ChatInfo[] = [];
  for(const d of dialogs) {
    const peerId = Number(d?.peerId);
    if(!peerId || peerId > 0 || d._ !== 'dialog') continue;
    const chat = await mgr.appChatsManager.getChat(-peerId).catch((): any => undefined);
    if(!chat || chat._ === 'chatForbidden' || chat._ === 'channelForbidden' || chat.pFlags?.left || chat.pFlags?.deactivated) continue;
    if(chat.pFlags?.creator) continue;                              // o'zingiz yaratganlarga tegmaymiz
    const top = d.top_message ? await mgr.appMessagesManager.getMessageByPeer(peerId, d.top_message).catch((): any => undefined) : undefined;
    out.push({
      id: String(peerId),
      name: chat.title || 'Nomsiz',
      kind: chat._ === 'channel' && !chat.pFlags?.megagroup ? 'channel' : 'group',
      unread: d.unread_count || 0,
      lastMsg: top?.date || 0,
      muted: muted(d.notify_settings),
      archived: d.folder_id === 1,
      opened: opened[String(peerId)]
    });
  }
  return out;
}

export function openChatsCleaner(onBack?: () => void) {
  const now = Math.floor(Date.now() / 1000), since = trackSince();
  const trackDays = since ? Math.floor((now - since) / 86400) : 0;
  return openCleaner<ChatInfo, ChatFilter, Sort>({
    title: 'Kanal va guruhlarni tozalash',
    placeholder: 'Qidirish: nomi',
    noun: 'chat',
    filters: FILTERS,
    sorts: [['unread', 'o\'qilmagan'], ['opened', 'oxirgi ochilgan'], ['active', 'oxirgi xabar'], ['name', 'nomi']],
    load: loadChats,
    match: (c, f) => matchChat(c, f, now, since),
    sort: sortChats,
    search: (c, q) => c.name.toLowerCase().includes(q),
    sub: (c) => [c.kind === 'channel' ? 'Kanal' : 'Guruh', c.opened ? `ochilgan: ${agoText(c.opened, now)}` : '', c.lastMsg ? `oxirgi xabar: ${agoText(c.lastMsg, now)}` : '', c.muted ? 'ovozsiz' : '', c.archived ? 'arxivda' : ''].filter(Boolean).join(' · '),
    badge: (c) => c.unread ? (c.unread > 999 ? '999+' : String(c.unread)) : '',
    hint: (f) => f === 'notOpened' && trackDays < 30 ?
      `Toza qaysi chatni qachon ochganingizni ${trackDays ? trackDays + ' kundan' : 'bugundan'} beri eslab boryapti. Hozircha 20 tadan ko'p o'qilmagan xabari borlar ko'rsatiladi, vaqt o'tgan sari aniqroq bo'ladi.` :
      'O\'zingiz yaratgan kanal va guruhlar bu ro\'yxatda yo\'q.',
    action: {
      batch: 1,
      label: (n) => `Chiqib ketish (${n})`,
      confirmTitle: 'Rostdan chiqib ketilsinmi?',
      confirm: (n) => `${n} ta kanal yoki guruhdan chiqasiz, ular chatlar ro'yxatidan yo'qoladi. Qaytish uchun havola yoki qidiruv orqali qayta qo'shilish kerak bo'ladi. Yopiq guruhga taklifsiz qaytib bo'lmaydi.`,
      yes: (n) => `Ha, ${n} tasidan chiqish`,
      doing: 'Chiqilmoqda…',
      done: (n) => `${n} ta kanal va guruhdan chiqildi.`,
      run: async(ids) => {
        const mgr = (rootScope as any).managers;
        for(const id of ids) {
          await mgr.appChatsManager.leave(-Number(id));
          await sleep(LEAVE_GAP_MS);                                // Telegram juda tez so'rovlarni cheklaydi
        }
        return ids.length;
      }
    }
  }, onBack);
}
