# Web build of the app, served as static files by nginx.
# EXPO_PUBLIC_* values are compiled into the bundle, so pass them as build args.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG EXPO_PUBLIC_API_URL
ARG EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=""
ARG EXPO_PUBLIC_PRIVACY_URL=""
ARG EXPO_PUBLIC_TERMS_URL=""
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL \
    EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=$EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID \
    EXPO_PUBLIC_PRIVACY_URL=$EXPO_PUBLIC_PRIVACY_URL \
    EXPO_PUBLIC_TERMS_URL=$EXPO_PUBLIC_TERMS_URL \
    EXPO_NO_TELEMETRY=1
RUN test -n "$EXPO_PUBLIC_API_URL" || (echo "EXPO_PUBLIC_API_URL build arg is required" && exit 1)
RUN npx expo export --platform web --output-dir dist

FROM nginx:1.27-alpine
ARG EXPO_PUBLIC_API_URL
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template
# CSP connect-src; set API_ORIGIN_WS=wss://api.example.com at run time for Socket.IO.
ENV API_ORIGIN=$EXPO_PUBLIC_API_URL API_ORIGIN_WS=""
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
