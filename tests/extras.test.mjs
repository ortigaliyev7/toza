// Toza qo'shimchalari: ZIP, statistika, PIN. Ishga tushirish: node --experimental-strip-types --test tests/
import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildZip, crc32, uniqueName, emptyUsage, bumpDay, bumpChat, pruneUsage, summarizeUsage, localDay, fmtSpent, hashPin, validPin, pinDelay} from '../overlay/src/lib/toza/extras-core.ts';

test('crc32 ma\'lum qiymat', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xCBF43926);
});

test('ZIP: unzip/python ochadi, ichidagi baytlar to\'g\'ri', () => {
  const a = new TextEncoder().encode('salom dunyo'), b = crypto.getRandomValues(new Uint8Array(60000));
  const parts = buildZip([{name: 'rasm/salom.txt', data: a}, {name: 'ўзбек.bin', data: b}]);
  const dir = mkdtempSync(join(tmpdir(), 'tz-zip-'));
  const f = join(dir, 'x.zip');
  writeFileSync(f, Buffer.concat(parts.map((p) => Buffer.from(p))));
  const py = `import zipfile,sys\nz=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None\nprint('|'.join(z.namelist()));print(len(z.read('ўзбек.bin')));print(z.read('rasm/salom.txt').decode())`;
  const out = execFileSync('python3', ['-c', py, f]).toString().trim().split('\n');
  assert.deepEqual(out, ['rasm/salom.txt|ўзбек.bin', '60000', 'salom dunyo']);
  assert.equal(Buffer.compare(Buffer.from(b), Buffer.from(execFileSync('python3', ['-c', `import zipfile,sys;sys.stdout.buffer.write(zipfile.ZipFile(sys.argv[1]).read('ўзбек.bin'))`, f]))), 0);
});

test('uniqueName takrorni raqamlaydi va xavfli belgilarni olib tashlaydi', () => {
  const used = new Set();
  assert.equal(uniqueName('a.jpg', used), 'a.jpg');
  assert.equal(uniqueName('A.jpg', used), 'A (2).jpg');
  assert.equal(uniqueName('../x/y:z.mp4', used), '_x_y_z.mp4');
  assert.equal(uniqueName('', used), 'fayl');
});

test('statistika: kunlar, chatlar, qisqartirish', () => {
  const now = new Date(2026, 10, 27, 12).getTime();
  const u = emptyUsage(now);
  const today = localDay(now), yest = localDay(now - 86400000);
  bumpDay(u, today, 's', 600); bumpDay(u, today, 'o', 3); bumpDay(u, yest, 'i', 5); bumpDay(u, localDay(now - 200 * 86400000), 'o');
  bumpChat(u, '1', 'o', 1); bumpChat(u, '1', 'o', 2); bumpChat(u, '2', 'i', 3); bumpChat(u, '2', 'n', 3); bumpChat(u, '2', 'n', 4);
  pruneUsage(u, now);
  assert.equal(Object.keys(u.days).length, 2);
  const s = summarizeUsage(u, now, 7);
  assert.equal(s.series.length, 7);
  assert.equal(s.series[6].day, today);
  assert.deepEqual([s.sec, s.sent, s.recv, s.activeDays], [600, 3, 5, 1]);
  assert.deepEqual(s.top.map((c) => c.peerId), ['1', '2']);
  assert.deepEqual(s.topOpened, [{peerId: '2', n: 2}]);
  for(let i = 0; i < 400; i++) bumpChat(u, 'x' + i, 'i', i);
  pruneUsage(u, now, 90, 300);
  assert.equal(Object.keys(u.chats).length, 300);
  assert.ok(u.chats['1']);
});

test('fmtSpent', () => {
  assert.equal(fmtSpent(0), '0 daqiqa');
  assert.equal(fmtSpent(20), '1 daqiqadan kam');
  assert.equal(fmtSpent(45 * 60), '45 daqiqa');
  assert.equal(fmtSpent(125 * 60), '2 soat 5 daqiqa');
});

test('PIN: tekshiruv, xesh, kutish', async() => {
  assert.ok(validPin('1234')); assert.ok(!validPin('12a4')); assert.ok(!validPin('123'));
  const a = await hashPin('1234', 's1', 1000), b = await hashPin('1234', 's1', 1000), c = await hashPin('1235', 's1', 1000), d = await hashPin('1234', 's2', 1000);
  assert.equal(a, b); assert.notEqual(a, c); assert.notEqual(a, d); assert.equal(a.length, 64);
  assert.deepEqual([pinDelay(4), pinDelay(5), pinDelay(6), pinDelay(20)], [0, 30, 60, 900]);
});
