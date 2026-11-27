// Toza: ko'rinish va ishonch (Telegram logotipi/nomi o'rniga o'z belgimiz, birinchi kirishdan oldingi tushuntirish).
// Ishlatish: node brand.mjs <tweb manba papkasi>
import fs from 'node:fs';

const src = process.argv[2];
if(!src) throw new Error('papka kerak');
const read = (p) => fs.readFileSync(`${src}/${p}`, 'utf8');
const write = (p, s) => fs.writeFileSync(`${src}/${p}`, s);
const must = (cond, what) => { if(!cond) throw new Error('brand.mjs: topilmadi — ' + what); };

// 1) Telegram uchqichi o'rniga Toza belgisi (kirish sahifalaridagi `#logo`): yumshoq to'rtburchak ichida «T» va uchqun (evenodd bilan kesilgan); ranglar tweb mavzusidan
let html = read('index.html');
const LOGO = '<path id="logo" fill-rule="evenodd" d="M46,0H114A46,46 0 0 1 160,46V114A46,46 0 0 1 114,160H46A46,46 0 0 1 0,114V46A46,46 0 0 1 46,0Z M34,50H108V68H80V120H62V68H34Z M124.00,23.00 L124.28,24.87 L124.67,26.61 L125.19,28.23 L125.84,29.73 L126.60,31.11 L127.49,32.37 L128.50,33.50 L129.63,34.51 L130.89,35.40 L132.27,36.16 L133.77,36.81 L135.39,37.33 L137.13,37.72 L139.00,38.00 L137.13,38.28 L135.39,38.67 L133.77,39.19 L132.27,39.84 L130.89,40.60 L129.63,41.49 L128.50,42.50 L127.49,43.63 L126.60,44.89 L125.84,46.27 L125.19,47.77 L124.67,49.39 L124.28,51.13 L124.00,53.00 L123.72,51.13 L123.33,49.39 L122.81,47.77 L122.16,46.27 L121.40,44.89 L120.51,43.63 L119.50,42.50 L118.37,41.49 L117.11,40.60 L115.73,39.84 L114.23,39.19 L112.61,38.67 L110.87,38.28 L109.00,38.00 L110.87,37.72 L112.61,37.33 L114.23,36.81 L115.73,36.16 L117.11,35.40 L118.37,34.51 L119.50,33.50 L120.51,32.37 L121.40,31.11 L122.16,29.73 L122.81,28.23 L123.33,26.61 L123.72,24.87Z"/>';
must(/<path id="logo"[^>]*>/.test(html), '#logo');
html = html.replace(/<path id="logo"[^>]*>/, LOGO);

// 2) Birinchi kirishdan oldingi tushuntirish + CSS yuklanmaganda «Qayta yuklash»
const intro = fs.readFileSync(`${src}/toza-intro.html`, 'utf8');
must(html.includes('</body>'), '</body>');
html = html.replace('</body>', intro + '\n  </body>');
// Android Chrome (108+) klaviatura ochilganda sahifani siljitadi va chat sarlavhasi (profil) ekrandan chiqib ketadi.
// `interactive-widget=resizes-content` — klaviatura chiqqanda sahifa kichrayadi, sarlavha joyida qoladi.
if(!html.includes('interactive-widget')) html = html.replace('viewport-fit=cover"', 'viewport-fit=cover,interactive-widget=resizes-content"');
write('index.html', html);

// 3) Kirish sarlavhasi
let lang = read('src/langSign.ts');
must(lang.includes("'Login.Title': 'Sign in to Telegram'"), 'Login.Title');
write('src/langSign.ts', lang.replace("'Login.Title': 'Sign in to Telegram'", "'Login.Title': 'Sign in with Toza'"));

// 4) Kirish kartasidagi belgi: tayyor rasm (assets/img/logo_512.png)
let card = read('src/pages/cards/SignInCard.tsx');
const OLD = /<svg class=\{styles\.logo\}[^>]*>\s*<use href="#logo"\/>\s*<\/svg>/;
must(OLD.test(card), 'SignInCard logo');
write('src/pages/cards/SignInCard.tsx', card.replace(OLD, '<img class={styles.logo} src="assets/img/logo_512.png" alt="Toza" width="120" height="120" />'));
