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
cd "$SRC"
pnpm install --frozen-lockfile
pnpm exec vite build
rm -rf ../dist && cp -R dist ../dist
echo "tayyor: dist/"
