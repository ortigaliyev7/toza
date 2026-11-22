// Toza: ko'rinish va ishonch (Telegram logotipi/nomi o'rniga o'z belgimiz, birinchi kirishdan oldingi tushuntirish).
// Ishlatish: node brand.mjs <tweb manba papkasi>
import fs from 'node:fs';

const src = process.argv[2];
if(!src) throw new Error('papka kerak');
const read = (p) => fs.readFileSync(`${src}/${p}`, 'utf8');
const write = (p, s) => fs.writeFileSync(`${src}/${p}`, s);
const must = (cond, what) => { if(!cond) throw new Error('brand.mjs: topilmadi — ' + what); };

// 1) Telegram uchqichi o'rniga Toza belgisi (kirish sahifalaridagi `#logo`): ko'k doira ichida «T» (evenodd bilan kesilgan)
let html = read('index.html');
const LOGO = '<path id="logo" fill-rule="evenodd" d="M80,0 C124.18278,0 160,35.81722 160,80 C160,124.18278 124.18278,160 80,160 C35.81722,160 0,124.18278 0,80 C0,35.81722 35.81722,0 80,0 Z M42,46 L118,46 L118,62 L89,62 L89,116 L71,116 L71,62 L42,62 Z"/>';
must(/<path id="logo"[^>]*>/.test(html), '#logo');
html = html.replace(/<path id="logo"[^>]*>/, LOGO);

// 2) Birinchi kirishdan oldingi tushuntirish + CSS yuklanmaganda «Qayta yuklash»
const intro = fs.readFileSync(`${src}/toza-intro.html`, 'utf8');
must(html.includes('</body>'), '</body>');
html = html.replace('</body>', intro + '\n  </body>');
write('index.html', html);

// 3) Kirish sarlavhasi
let lang = read('src/langSign.ts');
must(lang.includes("'Login.Title': 'Sign in to Telegram'"), 'Login.Title');
write('src/langSign.ts', lang.replace("'Login.Title': 'Sign in to Telegram'", "'Login.Title': 'Sign in with Toza'"));
