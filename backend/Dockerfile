FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build && npm prune --omit=dev --legacy-peer-deps

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
RUN mkdir -p storage/files && chown -R node:node storage
USER node
EXPOSE 3000
# Migrations: locally/docker-compose — at startup (DB_MIGRATIONS_RUN=true);
# in production — a separate Cloud Run Job before deployment: node dist/database/migrate.js
CMD ["node", "dist/main.js"]
