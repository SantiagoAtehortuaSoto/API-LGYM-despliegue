FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

LABEL org.opencontainers.image.source="https://github.com/SantiagoAtehortuaSoto/API-LGYM-despliegue"
LABEL org.opencontainers.image.description="API LGYM lista para despliegue en GHCR y Render"

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
COPY scripts ./scripts

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD sh -c 'wget -q -O /dev/null "http://127.0.0.1:${PORT:-3000}/ping" || exit 1'

CMD ["node", "src/index.js"]
