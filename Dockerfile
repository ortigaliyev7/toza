# Toza: Telegram Web K ni yig'ib, nginx bilan tarqatadi (Railway)
FROM node:22-bookworm AS build
ARG VITE_API_ID
ARG VITE_API_HASH
ENV VITE_API_ID=$VITE_API_ID VITE_API_HASH=$VITE_API_HASH CI=true
RUN npm i -g pnpm@11.16.0
WORKDIR /w
COPY build.sh ./
COPY overlay ./overlay
RUN chmod +x build.sh && ./build.sh

FROM nginx:1.27-alpine
ENV PORT=8080
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /w/dist /usr/share/nginx/html
