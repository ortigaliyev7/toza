# Toza: Telegram Web K ni yig'ib, nginx bilan tarqatadi (Railway)
FROM node:22-bookworm AS build
ARG VITE_API_ID
ARG VITE_API_HASH
ARG VITE_TB_URL
ARG RAILWAY_GIT_COMMIT_SHA
ENV VITE_API_ID=$VITE_API_ID VITE_API_HASH=$VITE_API_HASH VITE_TB_URL=$VITE_TB_URL RAILWAY_GIT_COMMIT_SHA=$RAILWAY_GIT_COMMIT_SHA CI=true
RUN npm i -g pnpm@11.16.0
WORKDIR /w
COPY build.sh ./
COPY overlay ./overlay
COPY patches ./patches
COPY brand.mjs toza-changelog.json ./
RUN chmod +x build.sh && ./build.sh

FROM nginx:1.27-alpine
ENV PORT=8080
# Toza qaysi saytlar ichida ochilishi mumkin (bo'sh joy bilan). Railway Variables'da FRAME_ANCESTORS bilan almashtiriladi.
ENV FRAME_ANCESTORS="'self' https://sharpa-production.up.railway.app https://*.telegram.org https://web.telegram.org"
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY toza-br.conf /etc/nginx/toza-br.conf
COPY --from=build /w/dist /usr/share/nginx/html
# Maxfiylik siyosati, shartlar, ma'lumot o'chirish (Google Play talabi): /privacy.html, /terms.html, /delete.html
COPY site/ /usr/share/nginx/html/
# Android ilova (Google Play): /.well-known/assetlinks.json ANDROID_SHA256 dan yoziladi (tools/assetlinks.sh)
ENV ANDROID_PACKAGE="uz.toza.app" ANDROID_SHA256=""
COPY tools/assetlinks.sh /docker-entrypoint.d/40-toza-assetlinks.sh
RUN chmod +x /docker-entrypoint.d/40-toza-assetlinks.sh
