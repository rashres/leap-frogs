# Multi-stage build for NestJS auth service
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json tsconfig.json ./
RUN npm install

COPY src ./src
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app

COPY package.json .
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/main.js"]
