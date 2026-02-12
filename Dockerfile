# ─── Build stage ──────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++ sqlite-dev

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Seed the university database, then build Next.js (standalone)
RUN npm run build

# ─── Production stage ─────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache sqlite-dev

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Copy standalone server + static assets + data
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/data ./data

# better-sqlite3 needs the native binding at runtime
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=builder /app/node_modules/bindings ./node_modules/bindings
COPY --from=builder /app/node_modules/prebuild-install ./node_modules/prebuild-install
COPY --from=builder /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path

EXPOSE 3000

CMD ["node", "server.js"]
