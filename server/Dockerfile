
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build


FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY scripts ./scripts
COPY db/migrations ./db/migrations

EXPOSE 3000

CMD ["sh", "-c", "node --import tsx scripts/migrate.ts && node dist/index.js"]

