// Kontaktlarni tozalash: toifa bo'yicha saralash (uzoq kirmagan, o'chirilgan akkaunt, chat yo'q, raqamsiz), tez belgilash
// (bosib turish → belgilash rejimi, barmoqni surib ketma-ket belgilash, «hammasi»), tasdiqlab birdaniga o'chirish.
// Faqat Telegram kontaktlar ro'yxatidan o'chiriladi: chatlar va xabarlar qoladi.
import rootScope from '@lib/rootScope';
import {openCleaner} from './cleaner';
import {matchContact, sortContacts} from './tools-core';
import type {ContactFilter, ContactInfo} from './tools-core';

const FILTERS: [ContactFilter, string][] = [
  ['all', 'Hammasi'], ['inactiveMonth', '1 oydan beri kirmagan'], ['inactiveWeek', '1 haftadan beri'], ['deleted', 'O\'chirilgan akkaunt'], ['noChat', 'Chat yo\'q'], ['noPhone', 'Raqamsiz']
];
function statusText(c: ContactInfo, now: number): string {
  if(c.deleted) return 'O\'chirilgan akkaunt';
  const s = c.status;
  switch(s?._) {
    case 'userStatusOnline': return 'onlayn';
    case 'userStatusOffline': {
      const d = Math.floor((now - (s.was_online || 0)) / 86400);
      return d < 1 ? 'bugun kirgan' : d < 30 ? `${d} kun oldin` : d < 365 ? `${Math.floor(d / 30)} oy oldin` : `${Math.floor(d / 365)} yil oldin`;
    }
    case 'userStatusRecently': return 'yaqinda';
    case 'userStatusLastWeek': return 'shu hafta';
    case 'userStatusLastMonth': return 'shu oy';
    default: return 'uzoq vaqt oldin';
  }
}

export async function loadContacts(): Promise<ContactInfo[]> {
  const mgr = (rootScope as any).managers;
  const ids: (string | number)[] = await mgr.appUsersManager.getContacts(undefined, false, 'none');
  const out: ContactInfo[] = [];
  for(const id of ids) {
    const u = await mgr.appUsersManager.getUser(id);
    if(!u) continue;
    let hasChat = false;
    try { hasChat = !!(await mgr.appMessagesManager.getDialogOnly(Number(u.id)))?.top_message; } catch{ /* yo'q */ }
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || (u.pFlags?.deleted ? 'O\'chirilgan akkaunt' : u.phone ? '+' + u.phone : 'Nomsiz');
    out.push({id: String(u.id), name, phone: u.phone, deleted: !!u.pFlags?.deleted, bot: !!u.pFlags?.bot, status: u.status, hasChat});
  }
  return out;
}

export function openContactsCleaner(onBack?: () => void) {
  const now = Math.floor(Date.now() / 1000);
  return openCleaner<ContactInfo, ContactFilter, 'name' | 'seen'>({
    title: 'Kontaktlarni tozalash',
    placeholder: 'Qidirish: ism yoki raqam',
    noun: 'kontakt',
    filters: FILTERS,
    sorts: [['name', 'ism'], ['seen', 'oxirgi kirgan']],
    load: loadContacts,
    match: (c, f) => matchContact(c, f, now),
    sort: (l, by) => sortContacts(l, by, now),
    search: (c, q) => c.name.toLowerCase().includes(q) || (c.phone || '').includes(q.replace(/\D/g, '') || '\u0000'),
    sub: (c) => [statusText(c, now), c.phone ? '+' + c.phone : '', !c.hasChat ? 'chat yo\'q' : ''].filter(Boolean).join(' · '),
    action: {
      batch: 100,
      label: (n) => `O'chirish (${n})`,
      confirmTitle: 'Rostdan o\'chirilsinmi?',
      confirm: (n) => `${n} ta kontakt Telegram kontaktlaringizdan o'chiriladi. Chatlar va xabarlar qoladi. Qaytarish uchun ularni qayta qo'shish kerak bo'ladi.`,
      yes: (n) => `Ha, ${n} ta kontaktni o'chirish`,
      doing: 'O\'chirilmoqda…',
      done: (n) => `${n} ta kontakt o'chirildi.`,
      run: async(ids) => {
        await (rootScope as any).managers.appUsersManager.deleteContacts(ids.map((id) => (id as any).toUserId?.() ?? Number(id)));
        return ids.length;
      }
    }
  }, onBack);
}
