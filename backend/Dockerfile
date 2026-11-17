FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build && npm prune --omit=dev --legacy-peer-deps
# every module the API loads must resolve with the production dependencies only — otherwise the image
# would start on Cloud Run and die with MODULE_NOT_FOUND (as with lodash in v54); dummy env, no DB connection
RUN DATABASE_URL=postgres://build:build@localhost/build JWT_SECRET=build-only-not-a-secret-0123456789abcdef \
    node --input-type=module -e "await import('./dist/app.module.js')"

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
# IPv4 first: Cloud Run has no IPv6 egress, an AAAA record of a site would otherwise end in a connect timeout
ENV NODE_OPTIONS=--dns-result-order=ipv4first
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# fallback copy of the ЦЗО list of qualified providers (KEP_VERIFIER=dstu downloads a fresh one itself)
COPY --from=build /app/kep ./kep
COPY package.json ./
RUN mkdir -p storage/files && chown -R node:node storage
USER node
EXPOSE 3000
# Migrations: locally/docker-compose — at startup (DB_MIGRATIONS_RUN=true);
# in production — a separate Cloud Run Job before deployment: node dist/database/migrate.js
CMD ["node", "dist/main.js"]
