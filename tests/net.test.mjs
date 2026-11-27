// Aloqa va qo'ng'iroq yordamchilari. Ishga tushirish: node --experimental-strip-types --test tests/
import assert from 'node:assert/strict';
import test from 'node:test';

import {tierOf, videoCap, TierSmoother, FallbackTracker, FreezeDetector, looksSlow, packBackup, unpackBackup, backupKey, BackupError} from '../overlay/src/lib/toza/net-core.ts';

test('aloqa darajasi', () => {
  assert.equal(tierOf({kbps: 2000, loss: 0, rtt: 60}), 'good');
  assert.equal(tierOf({kbps: 700}), 'ok');
  assert.equal(tierOf({kbps: 2000, loss: 8}), 'weak');
  assert.equal(tierOf({kbps: 80}), 'bad');
  assert.equal(tierOf({rtt: 900}), 'bad');
  assert.equal(tierOf({}), 'good');                    // Firefox: o'lchov yo'q — cheklamaymiz
  assert.equal(videoCap('good'), null);
  assert.ok(videoCap('bad').maxBitrate < videoCap('weak').maxBitrate);
});

test('daraja tez pasayadi, sekin ko\'tariladi', () => {
  const s = new TierSmoother();
  s.push('bad'); s.push('bad');
  assert.equal(s.tier, 'good');
  assert.equal(s.push('bad'), 'bad');
  for(let i = 0; i < 7; i++) assert.equal(s.push('good'), 'bad');
  assert.equal(s.push('good'), 'good');
});

test('video qotsa ovozga o\'tadi, aloqa tiklansa qaytarishni taklif qiladi', () => {
  const f = new FallbackTracker();
  for(let i = 0; i < 5; i++) assert.equal(f.push('bad', false, true), null);
  assert.equal(f.push('bad', false, true), 'toAudio');
  for(let i = 0; i < 19; i++) assert.equal(f.push('good', false, false), null);
  assert.equal(f.push('good', false, false), 'backToVideo');
  // foydalanuvchi o'zi o'chirgan videoni qaytarishni taklif qilmaymiz
  const g = new FallbackTracker();
  for(let i = 0; i < 30; i++) assert.equal(g.push('good', false, false), null);
});

test('qotgan videoni aniqlash', () => {
  const d = new FreezeDetector();
  assert.equal(d.push(10, true), false);
  [10, 10, 10].forEach((n) => assert.equal(d.push(n, true), false));
  assert.equal(d.push(10, true), true);
  assert.equal(d.push(11, true), false);
  assert.equal(d.push(11, false), false);
});

test('sekin internet', () => {
  assert.equal(looksSlow({effectiveType: '2g'}), true);
  assert.equal(looksSlow({saveData: true, effectiveType: '4g'}), true);
  assert.equal(looksSlow({effectiveType: '4g', downlink: 10}), false);
  assert.equal(looksSlow(undefined), false);
});

test('sozlamalar zaxirasi: kodlar kirmaydi, parol bilan shifrlanadi', async() => {
  assert.equal(backupKey('toza_templates'), true);
  assert.equal(backupKey('toza_code'), false);
  assert.equal(backupKey('toza_biz_paid'), false);
  assert.equal(backupKey('other'), false);
  const keys = {toza_templates: '["salom"]', toza_hidden: '{"x":1}', toza_code: 'SECRET', foo: 'bar'};
  const open = await packBackup(keys);
  assert.deepEqual(Object.keys(open.keys).sort(), ['toza_hidden', 'toza_templates']);
  assert.deepEqual(await unpackBackup(JSON.stringify(open)), {toza_templates: '["salom"]', toza_hidden: '{"x":1}'});
  const enc = await packBackup(keys, 'parol1');
  const raw = JSON.stringify(enc);
  assert.ok(!raw.includes('salom'));
  await assert.rejects(unpackBackup(raw), (e) => e instanceof BackupError && e.message === 'pass');
  await assert.rejects(unpackBackup(raw, 'xato'), (e) => e instanceof BackupError && e.message === 'pass');
  assert.equal((await unpackBackup(raw, 'parol1')).toza_templates, '["salom"]');
  await assert.rejects(unpackBackup('{"a":1}'), (e) => e.message === 'format');
});
