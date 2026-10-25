# API and worker image (same code; the compose command picks which one runs). Mirrors the
# Render build: npm ci, prisma generate, then tsx. Local use only (docker compose --profile app).
FROM node:24.16.0-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .
# prisma.config.ts reads DIRECT_URL; generating the client needs no database.
RUN DIRECT_URL=postgresql://build@localhost:5432/build npx prisma generate \
  && chown -R node:node /app

USER node
EXPOSE 5001
CMD ["npm", "start"]
