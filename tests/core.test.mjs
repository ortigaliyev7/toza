// Toza zaxirasi yadrosi: kalitlar, shifrlash, arxiv, sinxronlash. Ishga tushirish: node --experimental-strip-types --test tests/
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  Archive, MemoryStore, VOICE_MAX_BYTES, voiceKey, isVoiceKey, mediaKey, isBlobKey, MEDIA_PART_BYTES, MEDIA_MAX_BYTES, Sync, TozaApiError, decryptChunk, deriveKeys, encryptChunk, formatCode, generateRecoveryCode, keyOf, mergeMessage, normalizeCode, restoreInto
} from '../overlay/src/lib/toza/core.ts';

const te = new TextEncoder();
const td = new TextDecoder();

/** Serverning /tb/* xatti-harakatini (tbackup.py) taqlid qiluvchi xotiradagi soxta server. */
function fakeServer({quota = 25 * 1024 * 1024, paid = true} = {}) {
  const meta = new Map(); // id -> verifier
  const chunks = new Map(); // id -> Map(seq -> Uint8Array)
  const seen = []; // serverga tushgan hamma baytlar (ochiq matn yo'qligini tekshirish uchun)
  const sha = async (hex) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(hex.match(/../g).map((h) => parseInt(h, 16))))), (b) => b.toString(16).padStart(2, '0')).join('');
  const json = (o, status = 200) => new Response(JSON.stringify(o), {status, headers: {'Content-Type': 'application/json'}});
  const f = async (url, init = {}) => {
    const u = new URL(url);
    const h = init.headers || {};
    const id = h['X-TB-Id'], tok = h['X-TB-Token'];
    if(u.pathname === '/tb/init') {
      if(meta.has(id)) return (await sha(tok)) === meta.get(id) ? json({status: 'exists'}) : json({error: 'denied'}, 403);
      meta.set(id, await sha(tok)); chunks.set(id, new Map());
      return json({status: 'created'});
    }
    if(!meta.has(id)) return json({error: 'none'}, 404);
    if((await sha(tok)) !== meta.get(id)) return json({error: 'denied'}, 403);
    const store = chunks.get(id);
    const m = u.pathname.match(/^\/tb\/chunk\/(\d+)$/);
    if(m && init.method === 'PUT') {
      const body = new Uint8Array(await new Response(init.body).arrayBuffer());
      if(h['X-TB-Kind'] === 'media' && !paid) return json({error: 'paid_only'}, 402);
      seen.push(body);
      const used = [...store.entries()].filter(([s]) => s !== +m[1]).reduce((a, [, v]) => a + v.length, 0);
      if(used + body.length > quota) return json({error: 'quota'}, 507);
      store.set(+m[1], body);
      return json({ok: true});
    }
    if(m && init.method === 'GET') return store.has(+m[1]) ? new Response(store.get(+m[1])) : json({error: 'none'}, 404);
    if(u.pathname === '/tb/list') return json({chunks: [...store.entries()].map(([seq, v]) => ({seq, size: v.length, ts: 0})).sort((a, b) => a.seq - b.seq), used: [...store.values()].reduce((a, v) => a + v.length, 0), quota, linked: false, updated: 0});
    if(u.pathname === '/tb/reset' && init.method === 'POST') { chunks.set(id, new Map()); return json({ok: true}); }
    if(u.pathname === '/tb/device' && init.method === 'POST') return json({k: 'dev-token-123', url: 'https://sharpa.test/v2/'});
    if(u.pathname === '/tb/link') return JSON.parse(init.body).code === 'GOOD1234' ? json({ok: true}) : json({error: 'bad_code'}, 400);
    if(u.pathname === '/tb' && init.method === 'DELETE') { meta.delete(id); chunks.delete(id); return json({ok: true}); }
    return json({error: 'bad'}, 400);
  };
  return {fetch: f, meta, chunks, seen};
}

test('tiklash kodi: format, normallashtirish, deterministik kalitlar', async () => {
  const code = generateRecoveryCode();
  assert.match(code, /^([A-Z2-7]{4}-){6}[A-Z2-7]{2}$/);
  assert.notEqual(code, generateRecoveryCode());
  assert.equal(normalizeCode(code.toLowerCase().replaceAll('-', ' ')), code.replaceAll('-', ''));
  for(const bad of ['', 'abc', code + 'A', code.slice(0, -1), '0'.repeat(26), '1'.repeat(26), '8'.repeat(26)]) assert.equal(normalizeCode(bad), null);
  const a = await deriveKeys(code), b = await deriveKeys(code.toLowerCase());
  assert.equal(a.id, b.id); assert.equal(a.token, b.token);
  assert.match(a.id, /^[0-9a-f]{64}$/); assert.match(a.token, /^[0-9a-f]{64}$/);
  assert.notEqual(a.id, a.token);
  assert.notEqual((await deriveKeys(generateRecoveryCode())).id, a.id);
  await assert.rejects(deriveKeys('xx'), /bad_code/);
  assert.equal(a.key.extractable, false); // shifrlash kaliti brauzerdan chiqarib bo'lmaydi
});

test('shifrlash: aylanish, har safar boshqa IV, noto\'g\'ri kalit/buzilgan bo\'lak rad etiladi', async () => {
  const k1 = await deriveKeys(generateRecoveryCode()), k2 = await deriveKeys(generateRecoveryCode());
  const plain = te.encode('Salom, bu maxfiy xabar. '.repeat(200));
  const c1 = await encryptChunk(k1.key, plain), c2 = await encryptChunk(k1.key, plain);
  assert.notDeepEqual(c1, c2);
  assert.ok(c1.length < plain.length / 5); // gzip ishlaydi
  assert.deepEqual(await decryptChunk(k1.key, c1), plain);
  await assert.rejects(decryptChunk(k2.key, c1));
  const tampered = c1.slice(); tampered[tampered.length - 1] ^= 1;
  await assert.rejects(decryptChunk(k1.key, tampered));
  await assert.rejects(decryptChunk(k1.key, new Uint8Array(5)), /bad_chunk/);
});

test('arxiv: yangi xabar, tahrir versiyalari, o\'chirilgan belgisi', async () => {
  let t = 1_000_000;
  const arc = new Archive(new MemoryStore(), () => (t += 1000));
  assert.equal(await arc.capture({peerId: 5, mid: 1, date: 10, from: 7, text: 'salom'}), 'new');
  assert.equal(await arc.capture({peerId: 5, mid: 1, date: 10, text: 'salom'}), 'same');
  assert.equal(await arc.capture({peerId: 5, mid: 1, date: 10, text: 'salom, dunyo'}), 'edited');
  await arc.capture({peerId: 5, mid: 2, date: 11, text: 'ikkinchi'});
  assert.equal(await arc.deleted(5, [1, 99]), 1); // 99 bizda yo'q — sanalmaydi
  assert.equal(await arc.deleted(5, [1]), 0); // ikkinchi marta sanalmaydi
  const del = await arc.deletedMessages();
  assert.equal(del.length, 1);
  assert.equal(del[0].text, 'salom, dunyo'); assert.deepEqual(del[0].edits.map((e) => e.text), ['salom']);
  assert.ok(del[0].deleted > 0);
});

test('birlashtirish: o\'chirilgan belgisi yo\'qolmaydi, versiyalar birlashadi, matn yangisidan', () => {
  const base = {k: keyOf(1, 1), peerId: '1', mid: 1, date: 1, text: 'v1', u: 10};
  const edited = {...base, text: 'v2', u: 20, edits: [{t: 5, text: 'v1'}]};
  const deleted = {...base, deleted: 99, u: 15};
  const m = mergeMessage(edited, deleted);
  assert.equal(m.text, 'v2'); assert.equal(m.deleted, 99); assert.equal(m.edits.length, 1);
  assert.deepEqual(mergeMessage(deleted, edited), m); // tartibga bog'liq emas
});

test('sinxronlash: yuklash -> yangi qurilmada tiklash; server ochiq matnni ko\'rmaydi', async () => {
  const code = generateRecoveryCode();
  const srv = fakeServer();
  const keys = await deriveKeys(code);
  const storeA = new MemoryStore(), arcA = new Archive(storeA);
  const secret = 'maxfiy-parol-12345';
  await arcA.capture({peerId: 1, mid: 1, date: 1, from: 2, text: 'Salom ' + secret});
  await arcA.capture({peerId: 1, mid: 2, date: 2, text: 'ikkinchi'});
  await arcA.deleted(1, [1]);
  const syncA = new Sync({baseUrl: 'https://srv.test', keys, store: storeA, fetch: srv.fetch});
  assert.equal(await syncA.init(), 'created'); assert.equal(await syncA.init(), 'exists');
  assert.equal(await syncA.flush(), 1);
  assert.equal((await storeA.dirty(10)).length, 0); // yuklangach «toza»
  assert.equal(await syncA.flush(), 0);
  for(const body of srv.seen) assert.ok(!td.decode(body).includes(secret)); // serverda ochiq matn yo'q

  // yangi qurilma: bo'sh arxiv, faqat tiklash kodi
  const keysB = await deriveKeys(code);
  const storeB = new MemoryStore(), arcB = new Archive(storeB);
  const res = await restoreInto(new Sync({baseUrl: 'https://srv.test', keys: keysB, store: storeB, fetch: srv.fetch}), arcB);
  assert.deepEqual(res, {messages: 2, deleted: 1});
  const del = await arcB.deletedMessages();
  assert.equal(del.length, 1); assert.ok(del[0].text.includes(secret));
  assert.equal((await storeB.dirty(10)).length, 0); // tiklanganlar qayta yuklanmaydi
});

test('sinxronlash: bo\'laklarga bo\'lish, davom ettirish (seq), keyingi flush yangi bo\'lak', async () => {
  const srv = fakeServer();
  const keys = await deriveKeys(generateRecoveryCode());
  const store = new MemoryStore(), arc = new Archive(store);
  for(let i = 0; i < 30; i++) await arc.capture({peerId: 1, mid: i, date: i, text: 'x'.repeat(300) + i});
  const sync = new Sync({baseUrl: 'https://srv.test/', keys, store, fetch: srv.fetch, maxBatchBytes: 3000});
  await sync.init();
  const n = await sync.flush();
  assert.ok(n >= 3);
  assert.equal((await sync.status()).chunks, n);
  await arc.capture({peerId: 1, mid: 100, date: 100, text: 'yangi'});
  assert.equal(await sync.flush(), 1);
  const sync2 = new Sync({baseUrl: 'https://srv.test', keys, store: new MemoryStore(), fetch: srv.fetch}); // sahifa qayta ochildi
  assert.equal((await sync2.fetchAll()).length, 31);
});

test('xatolar: begona kod, bo\'lmagan zaxira, hajm, bog\'lash, o\'chirish', async () => {
  const srv = fakeServer({quota: 600});
  const keys = await deriveKeys(generateRecoveryCode()), other = await deriveKeys(generateRecoveryCode());
  const store = new MemoryStore(), arc = new Archive(store);
  const sync = new Sync({baseUrl: 'https://srv.test', keys, store, fetch: srv.fetch});
  await assert.rejects(sync.status(), (e) => e instanceof TozaApiError && e.status === 404); // zaxira yo'q (tiklashda «noto'g'ri kod»)
  await sync.init();
  await assert.rejects(new Sync({baseUrl: 'https://srv.test', keys: {...other, id: keys.id}, store, fetch: srv.fetch}).status(), (e) => e.status === 403);
  for(let i = 0; i < 40; i++) await arc.capture({peerId: 1, mid: i, date: i, text: Math.random().toString(36).repeat(8)});
  await assert.rejects(sync.flush(), (e) => e.status === 507 && e.code === 'quota');
  assert.ok((await store.dirty(100)).length > 0); // yuklanmagan yozuvlar yo'qolmaydi
  await sync.link('GOOD1234');
  await assert.rejects(sync.link('nope'), (e) => e.code === 'bad_code');
  await sync.wipe();
  await assert.rejects(sync.status(), (e) => e.status === 404);
});

test('formatCode', () => assert.equal(formatCode('ABCDEFGHIJ'), 'ABCD-EFGH-IJ'));

test('ovozli xabar: bir marta saqlanadi, o\'chirilgan ro\'yxatni to\'ldirmaydi, katta ovoz rad etiladi', async () => {
  const store = new MemoryStore(), arc = new Archive(store);
  const b64 = Buffer.from(new Uint8Array(40_000).fill(7)).toString('base64');
  await arc.capture({peerId: 5, mid: 9, date: 1, text: '', kind: 'messageMediaDocument'});
  assert.equal(await arc.captureVoice({peerId: 5, mid: 9, date: 1}, {mime: 'audio/ogg', dur: 12, b64}), true);
  assert.equal(await arc.captureVoice({peerId: 5, mid: 9, date: 1}, {mime: 'audio/ogg', dur: 12, b64}), false); // qayta yozilmaydi
  assert.equal((await arc.voiceOf(5, 9)).dur, 12);
  assert.equal(await arc.voiceOf(5, 10), undefined);
  assert.equal(await arc.captureVoice({peerId: 5, mid: 11, date: 1}, {mime: 'audio/ogg', dur: 1, b64: 'A'.repeat(Math.ceil((VOICE_MAX_BYTES + 10) * 4 / 3))}), false); // katta
  await arc.deleted(5, [9]);                                   // xabar o'chirildi: faqat xabar yozuvi belgilanadi
  const del = await arc.deletedMessages();
  assert.equal(del.length, 1); assert.equal(del[0].k, '5:9'); assert.ok(isVoiceKey(voiceKey(5, 9)));
  assert.ok((await arc.voiceOf(5, 9)).b64 === b64);           // ovoz saqlanib qoladi
});

test('ovozli xabar: shifrlangan zaxiraga chiqadi va yangi qurilmada tiklanadi; o\'chirilgandan keyin qayta yuklanmaydi', async () => {
  const code = generateRecoveryCode(), srv = fakeServer(), keys = await deriveKeys(code);
  const storeA = new MemoryStore(), arcA = new Archive(storeA);
  const b64 = Buffer.from(new Uint8Array(300_000).map((_, i) => (i * 31) % 251)).toString('base64');
  await arcA.capture({peerId: 1, mid: 3, date: 1, text: '', kind: 'messageMediaDocument'});
  await arcA.captureVoice({peerId: 1, mid: 3, date: 1}, {mime: 'audio/ogg', dur: 20, b64});
  const syncA = new Sync({baseUrl: 'https://srv.test', keys, store: storeA, fetch: srv.fetch});
  await syncA.init();
  await syncA.flush();
  const sent = srv.seen.length;
  await arcA.deleted(1, [3]);                                  // o'chirildi: faqat kichik xabar yozuvi qayta yuklanadi
  await syncA.flush();
  assert.ok(srv.seen.slice(sent).every((x) => x.length < 2000), 'ovoz qayta yuklanmasligi kerak');
  for(const body of srv.seen) assert.ok(!td.decode(body).includes(b64.slice(0, 40)));      // serverda ochiq ovoz yo'q
  const storeB = new MemoryStore(), arcB = new Archive(storeB);
  const res = await restoreInto(new Sync({baseUrl: 'https://srv.test', keys: await deriveKeys(code), store: storeB, fetch: srv.fetch}), arcB);
  assert.equal(res.deleted, 1);
  assert.equal((await arcB.voiceOf(1, 3)).b64, b64);
});

test('rasm/dumaloq video: bo\'laklarga bo\'linadi, bir marta saqlanadi, yig\'iladi; katta fayl rad etiladi', async () => {
  const arc = new Archive(new MemoryStore());
  const bytes = new Uint8Array(2_000_000).map((_, i) => (i * 7) % 256);
  assert.equal(await arc.captureMedia({peerId: 3, mid: 4, date: 1}, 'photo', 'image/jpeg', 0, bytes), true);
  assert.equal(await arc.captureMedia({peerId: 3, mid: 4, date: 1}, 'photo', 'image/jpeg', 0, bytes), false);
  const got = await arc.mediaOf(3, 4);
  assert.equal(got.b64.length, Math.ceil(2_000_000 / MEDIA_PART_BYTES));
  assert.deepEqual(new Uint8Array(Buffer.from(got.b64.join(''), 'base64').subarray(0, 0)), new Uint8Array(0));
  const joined = Buffer.concat(got.b64.map((x) => Buffer.from(x, 'base64')));
  assert.equal(joined.length, 2_000_000); assert.ok(joined.equals(Buffer.from(bytes)));
  assert.equal(await arc.captureMedia({peerId: 3, mid: 5, date: 1}, 'photo', 'image/jpeg', 0, new Uint8Array(MEDIA_MAX_BYTES.photo + 1)), false);
  assert.equal(await arc.mediaOf(3, 99), undefined);
  assert.ok(isBlobKey(mediaKey(3, 4, 0)) && !isBlobKey('3:4'));
  await arc.capture({peerId: 3, mid: 4, date: 1, text: 'sarlavha', kind: 'messageMediaPhoto'});
  await arc.deleted(3, [4]);
  assert.equal((await arc.deletedMessages()).length, 1);          // faqat xabar yozuvi, bo'laklar emas
});

test('zaxira: bepul akkauntda fayllar yuborilmaydi (matn ketadi); obunada rasm shifrlanib ketadi va tiklanadi', async () => {
  const code = generateRecoveryCode(), keys = await deriveKeys(code);
  const bytes = new Uint8Array(1_500_000).map((_, i) => (i * 13) % 256);
  const make = async (paid) => {
    const srv = fakeServer({paid}), store = new MemoryStore(), arc = new Archive(store);
    await arc.capture({peerId: 7, mid: 1, date: 1, text: 'salom', kind: undefined});
    await arc.captureMedia({peerId: 7, mid: 1, date: 1}, 'photo', 'image/jpeg', 0, bytes);
    const sync = new Sync({baseUrl: 'https://srv.test', keys, store, fetch: srv.fetch});
    await sync.init();
    return {srv, store, arc, sync};
  };
  const free = await make(false);
  await free.sync.flush();                                         // 402 qabul qilinadi, matn yuboriladi, qayta-qayta urinmaydi
  assert.equal(free.sync.mediaBlocked, true);
  assert.equal((await free.store.dirty(100)).filter((m) => isBlobKey(m.k)).length, 3);   // fayl bo'laklari yuborilmadi
  assert.equal((await free.store.dirty(100)).filter((m) => !isBlobKey(m.k)).length, 0);  // matn ketdi
  assert.equal(await free.sync.flush(), 0);                         // aylanib qolmaydi
  const paid = await make(true);
  await paid.sync.flush();
  assert.equal((await paid.store.dirty(100)).length, 0);
  const B = new Archive(new MemoryStore());
  await restoreInto(new Sync({baseUrl: 'https://srv.test', keys: await deriveKeys(code), store: B.store, fetch: paid.srv.fetch}), B);
  const got = await B.mediaOf(7, 1);
  assert.ok(Buffer.concat(got.b64.map((x) => Buffer.from(x, 'base64'))).equals(Buffer.from(bytes)));
  for(const body of paid.srv.seen) assert.ok(body.length < 1_600_000);   // bitta bo'lak 4 MB dan oshmaydi
});

import {describe as describeAlert} from '../overlay/src/lib/toza/alerts.ts';
test('xabar matni: o\'chirilgan va tahrirlangan, uzun matn qisqartiriladi', () => {
  assert.equal(describeAlert({kind: 'deleted', who: 'Ali', text: 'salom'}), "O'chirdi: «salom»");
  assert.equal(describeAlert({kind: 'edited', who: 'Ali', old: 'eski', text: 'yangi'}), "Tahrirladi: «eski» → «yangi»");
  const long = describeAlert({kind: 'deleted', who: 'Ali', text: 'x'.repeat(500)});
  assert.ok(long.length < 130 && long.includes('…'));
});

import {fmtDuration} from '../overlay/src/lib/toza/alerts.ts';
test('davomiylik: daqiqa, soat, kun', () => {
  assert.equal(fmtDuration(25 * 60000), '25 daqiqa');
  assert.equal(fmtDuration(150 * 60000), '2 soat 30 daqiqa');
  assert.equal(fmtDuration(120 * 3600000), '5 kun');
});

test('chatni zaxiradan olib tashlash: mahalliy nusxa o\'chadi, server qolgan chatlardan qayta yoziladi, begona chat saqlanadi', async () => {
  const code = generateRecoveryCode(), keys = await deriveKeys(code), srv = fakeServer();
  const store = new MemoryStore(), arc = new Archive(store);
  const sync = new Sync({baseUrl: 'https://srv.test', keys, store, fetch: srv.fetch});
  await sync.init();
  await arc.capture({peerId: 1, mid: 1, date: 1, text: 'birinchi chat maxfiy-1'});
  await arc.capture({peerId: 2, mid: 1, date: 1, text: 'ikkinchi chat'});
  await arc.captureVoice({peerId: 1, mid: 1, date: 1}, {mime: 'audio/ogg', dur: 3, b64: Buffer.from(new Uint8Array(500)).toString('base64')});
  await arc.captureMedia({peerId: 1, mid: 2, date: 1}, 'video', 'video/mp4', 5, new Uint8Array(900_000).fill(3));
  await sync.flush();
  assert.equal(await arc.purgePeer(1), 4);                       // 1 matn + 1 ovoz + 2 video bo'lagi
  await sync.reset(); await store.markAllDirty(); await sync.flush();
  const B = new Archive(new MemoryStore());
  await restoreInto(new Sync({baseUrl: 'https://srv.test', keys: await deriveKeys(code), store: B.store, fetch: srv.fetch}), B);
  const all = await B.store.all();
  assert.deepEqual(all.map((m) => m.peerId), ['2']);              // faqat ikkinchi chat qoldi
  assert.ok(!JSON.stringify(all).includes('maxfiy-1'));
  assert.equal(await B.voiceOf(1, 1), undefined); assert.equal(await B.mediaOf(1, 2), undefined);
  assert.ok(MEDIA_MAX_BYTES.video > MEDIA_MAX_BYTES.round);
});

import {searchArchive, computeStats, exportText, exportHtml, escHtml, newTemplate} from '../overlay/src/lib/toza/tools-core.ts';
async function seed() {
  const arc = new Archive(new MemoryStore());
  const t0 = 1_700_000_000;
  await arc.capture({peerId: 1, mid: 1, date: t0, text: 'Salom Ali, narx qancha?', out: true});
  await arc.capture({peerId: 1, mid: 2, date: t0 + 60, text: 'Narx 100 ming', out: false});
  await arc.capture({peerId: 1, mid: 2, date: t0 + 60, text: 'Narx 120 ming', out: false});     // tahrir
  await arc.capture({peerId: 2, mid: 1, date: t0 + 3600 * 24, text: 'boshqa chat <b>xavfli</b>', out: false});
  await arc.deleted(1, [1]);
  await arc.capture({peerId: 1, mid: 3, date: t0 + 120, text: '', kind: 'messageMediaDocument', out: false});
  await arc.captureVoice({peerId: 1, mid: 3, date: t0 + 120}, {mime: 'audio/ogg', dur: 3, b64: Buffer.from(new Uint8Array(300)).toString('base64')});
  return {arc, all: await arc.store.all(), t0};
}
test('qidiruv: matn va tahrir tarixidan, chat/o\'chirilgan/sana filtri, kichik-katta harf farqsiz', async () => {
  const {all, t0} = await seed();
  assert.equal(searchArchive(all, 'narx').length, 2);                      // 1:1 va 1:2 (matn va eski tahrir)
  assert.equal(searchArchive(all, '100 MING').length, 1);                 // eski (tahrirlangan) matndan topiladi
  assert.deepEqual(searchArchive(all, '', {deletedOnly: true}).map((m) => m.k), ['1:1']);
  assert.equal(searchArchive(all, '', {peerId: '2'}).length, 1);
  assert.equal(searchArchive(all, '', {from: t0 + 100}).length, 2);       // ovozli xabar (t0+120) va ikkinchi chat
  assert.equal(searchArchive(all, '', {limit: 1}).length, 1);
  assert.ok(searchArchive(all, '').every((m) => !m.k.startsWith('v:')));  // ovoz yozuvlari ro'yxatga kirmaydi
});
test('statistika: jami, o\'chirilgan/tahrirlangan, chat bo\'yicha hajm, kunlar va soatlar', async () => {
  const {all, t0} = await seed();
  const st = computeStats(all, t0 + 3600 * 24 + 10);
  assert.equal(st.messages, 4); assert.equal(st.deleted, 1); assert.equal(st.edited, 1); assert.equal(st.voices, 1);
  const c1 = st.byChat.find((c) => c.peerId === '1');
  assert.equal(c1.msgs, 3); assert.equal(c1.mine, 1); assert.equal(c1.theirs, 2); assert.equal(c1.files, 1); assert.ok(c1.bytes > 300);
  assert.equal(st.byDay.length, 30); assert.equal(st.byDay.reduce((a, d) => a + d.n, 0), 4);
  assert.equal(st.byHour.reduce((a, n) => a + n, 0), 4);
  assert.equal(st.byChat[0].peerId, '1');                                   // eng ko'p joy egallagan birinchi
});
test('eksport: matnli (.txt) va to\'liq (.html, ovoz ichiga joylangan, matn xavfsiz)', async () => {
  const {all} = await seed();
  const txt = exportText(all, '1', 'Ali');
  assert.ok(txt.includes('Siz: Salom Ali') && txt.includes('(o\'chirilgan') && txt.includes('oldingi') && !txt.includes('boshqa chat'));
  const voice = await new Archive(new MemoryStore()).store.all();
  const {html, skipped} = exportHtml(all, '1', 'Ali', (mid) => mid === 3 ? {kind: 'voice', mime: 'audio/ogg', b64: ['AAAA']} : undefined);
  assert.equal(skipped, 0); assert.ok(html.includes('<audio controls src="data:audio/ogg;base64,AAAA"'));
  const h2 = exportHtml(all, '2', '<script>x</script>', () => undefined).html;
  assert.ok(!h2.includes('<b>xavfli</b>') && h2.includes('&lt;b&gt;xavfli&lt;/b&gt;') && !h2.includes('<script>x'));   // XSS yo'q
  const big = exportHtml(all, '1', 'Ali', () => ({kind: 'photo', mime: 'image/jpeg', b64: ['A'.repeat(400)]}), {maxMediaBytes: 100});
  assert.ok(big.skipped >= 1 && big.html.includes('qo\'shilmadi'));
  assert.equal(escHtml('a&b"<'), 'a&amp;b&quot;&lt;'); void voice;
});
test('shablon: sarlavha, uzunlik cheklovi', () => {
  const t = newTemplate('', '  Rahmat, tez orada javob beraman  ', 'x1');
  assert.deepEqual(t, {id: 'x1', title: 'Rahmat, tez orada javob berama', text: 'Rahmat, tez orada javob beraman'});
  assert.equal(newTemplate('a'.repeat(100), 'b'.repeat(5000)).text.length, 2000);
});

test('Sharpa bo\'limlari: qurilma tokeni olinadi', async () => {
  const keys = await deriveKeys(generateRecoveryCode()), srv = fakeServer();
  const sync = new Sync({baseUrl: 'https://srv.test', keys, store: new MemoryStore(), fetch: srv.fetch});
  await sync.init();
  assert.deepEqual(await sync.device(), {k: 'dev-token-123', url: 'https://sharpa.test/v2/'});
});
