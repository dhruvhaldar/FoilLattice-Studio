FROM node:22-bookworm-slim

WORKDIR /app
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm install --omit=dev
COPY server/ ./
COPY config/ /app/config/
RUN mkdir -p /app/binaries

ENV HOST=0.0.0.0 \
    PORT=4317 \
    BINARY_ROOT=/app/binaries \
    SOLVER_CATALOG_PATH=/app/config/solver-catalog.json \
    ENABLE_SOLVER_MANAGEMENT=true \
    ALLOW_DEMO=true \
    NODE_ENV=production

RUN chown -R node:node /app
USER node
EXPOSE 4317
CMD ["node", "index.js"]
