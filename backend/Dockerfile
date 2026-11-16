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
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# the IIT library for the KEP check (backend/iit/README.md); without it — only the loader, the check and README
COPY --from=build /app/iit ./iit
COPY package.json ./
RUN mkdir -p storage/files && chown -R node:node storage
USER node
EXPOSE 3000
# Migrations: locally/docker-compose — at startup (DB_MIGRATIONS_RUN=true);
# in production — a separate Cloud Run Job before deployment: node dist/database/migrate.js
CMD ["node", "dist/main.js"]
