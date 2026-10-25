# Web app image: a production build served by `next start`. Local use only
# (docker compose --profile app); production runs on Vercel.

FROM node:24.16.0-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# NEXT_PUBLIC_* values are baked into the browser bundle here, from .env.local (the same
# file `npm run dev` uses). The API is not reachable during the image build, so pages that
# read it render on request (lib/serverApi.js).
RUN npm run build

FROM node:24.16.0-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/next.config.mjs ./
COPY --from=build /app/src/lib/cloudinaryLoader.js ./src/lib/cloudinaryLoader.js
# next start writes the ISR cache under .next, so the runtime user owns it.
COPY --from=build --chown=node:node /app/.next ./.next

USER node
EXPOSE 3000
CMD ["npx", "next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
