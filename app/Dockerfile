# syntax=docker/dockerfile:1
# Trustzen production image.
#   docker build -t trustzen .
#   docker run -p 3000:3000 -v trustzen-storage:/app/storage trustzen

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
RUN addgroup -S trustzen && adduser -S trustzen -G trustzen
COPY --from=build --chown=trustzen:trustzen /app/.next ./.next
COPY --from=build --chown=trustzen:trustzen /app/node_modules ./node_modules
COPY --from=build --chown=trustzen:trustzen /app/public ./public
COPY --from=build --chown=trustzen:trustzen /app/package.json /app/server.js /app/next.config.ts ./
RUN mkdir -p storage && chown trustzen:trustzen storage
USER trustzen
VOLUME ["/app/storage"]
EXPOSE 3000
CMD ["node", "server.js"]
