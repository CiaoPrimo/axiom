# ─────────────────────────────────────────────────────────────
#  Axiom Bot — Dockerfile
# ─────────────────────────────────────────────────────────────

FROM node:20-alpine

RUN addgroup -S axiom && adduser -S axiom -G axiom

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY src/ ./src/

RUN chown -R axiom:axiom /app
USER axiom

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD pgrep -f "node src/index.js" > /dev/null || exit 1

CMD ["node", "src/index.js"]
