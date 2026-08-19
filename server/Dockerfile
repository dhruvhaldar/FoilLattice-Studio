FROM node:22-bookworm-slim

WORKDIR /app
COPY server/package*.json ./
RUN npm install --omit=dev
COPY server/ ./
RUN mkdir /app/binaries

ENV HOST=0.0.0.0 \
    PORT=4317 \
    BINARY_ROOT=/app/binaries \
    ALLOW_DEMO=true \
    NODE_ENV=production

RUN chown -R node:node /app
USER node
EXPOSE 4317
CMD ["node", "index.js"]
