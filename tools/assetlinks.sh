#!/bin/sh
# Android ilova (Google Play) saytni tasdiqlashi uchun /.well-known/assetlinks.json (konteyner ishga tushganda).
# Railway Variables: ANDROID_SHA256 — Play Console → Setup → App signing dagi «SHA-256 certificate fingerprint»
# (bir nechtasi bo'lsa bo'sh joy bilan: App signing key + Upload key). ANDROID_PACKAGE — standart uz.toza.app.
set -eu
dir=/usr/share/nginx/html/.well-known
mkdir -p "$dir"
pkg="${ANDROID_PACKAGE:-uz.toza.app}"
list=""
for f in ${ANDROID_SHA256:-}; do list="${list:+$list,}\"$f\""; done
printf '[{"relation":["delegate_permission/common.handle_all_urls"],"target":{"namespace":"android_app","package_name":"%s","sha256_cert_fingerprints":[%s]}}]\n' "$pkg" "$list" > "$dir/assetlinks.json"
[ -n "$list" ] || echo "toza: ANDROID_SHA256 berilmagan — Android ilovada manzil satri ko'rinadi (assetlinks bo'sh)"
