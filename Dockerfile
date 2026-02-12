# ─── Build stage ──────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++ sqlite-dev

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Create public dir if it doesn't exist (Next.js standalone expects it)
RUN mkdir -p public

# Seed the university database, then build Next.js (standalone)
RUN npm run build

# ─── Production stage ─────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache sqlite-dev libstdc++

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Copy standalone server (includes node_modules with better-sqlite3)
COPY --from=builder /app/.next/standalone ./

# Copy static assets
COPY --from=builder /app/.next/static ./.next/static

# Copy public dir (may be empty but Next.js expects it)
COPY --from=builder /app/public ./public

# Copy seeded database + university data
COPY --from=builder /app/data ./data

EXPOSE 3000

CMD ["node", "server.js"]
