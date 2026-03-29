# ── Stage 1: install all deps ─────────────────────────────────────────────────
FROM node:20-bullseye AS deps
WORKDIR /app
COPY package*.json .npmrc ./
RUN npm ci

# ── Stage 2: build ────────────────────────────────────────────────────────────
FROM node:20-bullseye AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=3072"

# NEXT_PUBLIC_ vars must be present at build time so Next.js can inline them
ARG NEXT_PUBLIC_GOOGLE_MAPS_KEY
ARG NEXT_PUBLIC_GOOGLE_MAPS_ID
ENV NEXT_PUBLIC_GOOGLE_MAPS_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_KEY
ENV NEXT_PUBLIC_GOOGLE_MAPS_ID=$NEXT_PUBLIC_GOOGLE_MAPS_ID

RUN npx prisma generate
RUN npm run build

# ── Stage 3: minimal runtime ──────────────────────────────────────────────────
FROM node:20-bullseye-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Runtime secrets — supply via docker-compose environment or --env-file
ENV TWILIO_ACCOUNT_SID=""
ENV TWILIO_AUTH_TOKEN=""
ENV TWILIO_API_KEY=""
ENV TWILIO_API_SECRET=""
ENV TWILIO_FROM_NUMBER=""
ENV ZEROBOUNCE_API_KEY=""

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs nextjs && \
    mkdir -p .next/cache && chown -R nextjs:nodejs .next

# Standalone server + static assets
COPY --from=builder /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Prisma schema + generated client
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma        ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma        ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma         ./node_modules/prisma

USER nextjs
EXPOSE 3000

CMD ["node", "--max-old-space-size=3072", "server.js"]
