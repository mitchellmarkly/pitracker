FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV PI_DB_PATH=/data/pi-tracker.db
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
RUN mkdir -p /data
EXPOSE 3000
CMD ["node", "server/index.mjs"]
