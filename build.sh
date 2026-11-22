#!/usr/bin/env bash
# Telegram Web K ni aniq versiyada yuklab, overlay va rebrending (Toza) qo'yib yig'adi. Natija: dist/
set -euo pipefail
cd "$(dirname "$0")"
TWEB_REF="${TWEB_REF:-2e4bbb52b6aec5e95ee32e5c2882c1f05de32200}"      # 2026-11-11
SRC=".src"
[ -f .env.local ] && set -a && . ./.env.local && set +a
: "${VITE_API_ID:?VITE_API_ID kerak (.env.example)}"
: "${VITE_API_HASH:?VITE_API_HASH kerak (.env.example)}"
if [ ! -d "$SRC/.git" ]; then
  git init -q "$SRC"
  git -C "$SRC" remote add origin https://github.com/morethanwords/tweb
fi
git -C "$SRC" fetch -q --depth 1 origin "$TWEB_REF"
git -C "$SRC" checkout -q --force FETCH_HEAD
cp -R overlay/. "$SRC"/                                                # bizning o'zgartirishlar (bo'sh bo'lishi mumkin)

# Rebrending: ilovaning ko'rinadigan nomi «Toza» (Telegram nomi/belgisi ishlatilmaydi: Telegram API shartlari)
sed -i "s/title: 'Telegram Web',/title: 'Toza',/" "$SRC/vite.config.ts"
sed -i 's/"name": "Telegram Web"/"name": "Toza"/; s/"short_name": "Telegram Web"/"short_name": "Toza"/' "$SRC/public/site.webmanifest" "$SRC/public/site_apple.webmanifest"
sed -i 's/return `Telegram Web/return `Toza/' "$SRC/src/config/app.ts"

# Ko'rinish va ishonch: o'z logotipimiz, tushuntirish sahifasi, «Sign in with Toza»
node brand.mjs "$SRC"

# Toza zaxirasi: tweb'ga minimal o'zgartirishlar (patches/*.patch), asosiy kod overlay/src/lib/toza/ da
for p in patches/*.patch; do git -C "$SRC" apply --whitespace=nowarn "$(pwd)/$p"; done
[ -n "${VITE_TB_URL:-}" ] || echo "ESLATMA: VITE_TB_URL berilmagan — zaxira serveri sozlanmagan bo'ladi (.env.example)"
cd "$SRC"
pnpm install --frozen-lockfile
pnpm exec vite build
# tweb Vite'da `copyPublicDir: false`: statik fayllar (shriftlar, ikonka shrifti tgico, emoji rasmlari, tovushlar, manifest) yig'ishga KIRMAYDI — qo'lda ko'chiramiz.
# `public/` da eski tayyor yig'ma ham bor (js/html/version) — uni ko'chirmaymiz, faqat statikni.
for f in assets changelogs browserconfig.xml site.webmanifest site_apple.webmanifest; do [ -e "public/$f" ] && cp -R "public/$f" dist/; done
[ -f dist/assets/fonts/tgico.woff ] || { echo "XATO: dist/assets/fonts/tgico.woff yo'q — ikonkalar chiqmaydi"; exit 1; }
rm -rf ../dist && cp -R dist ../dist
echo "tayyor: dist/"
