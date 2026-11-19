FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# «/» — the domain to itself; «/oblik/» — behind the gateway of the domain with several applications
ARG BASE_HREF=/
RUN npx ng build --base-href "$BASE_HREF"

FROM node:22-alpine
WORKDIR /app
ARG BASE_HREF=/
ENV NODE_ENV=production PORT=4000 APP_BASE_PATH=$BASE_HREF
COPY --from=build /app/dist/frontend ./dist/frontend
COPY --from=build /app/node_modules ./node_modules
USER node
EXPOSE 4000
CMD ["node", "dist/frontend/server/server.mjs"]
