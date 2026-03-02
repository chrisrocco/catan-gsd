# --- Build stage ---
FROM node:22-slim AS build

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json tsconfig.json tsconfig.base.json ./

# Copy only the packages needed by the server
COPY packages/game-engine/package.json packages/game-engine/tsconfig.json packages/game-engine/
COPY packages/server/package.json packages/server/tsconfig.json packages/server/

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY packages/game-engine/src/ packages/game-engine/src/
COPY packages/server/src/ packages/server/src/

# Build game-engine first (server depends on it), then server
RUN npm run build -w @catan/game-engine && npm run build -w @catan/server

# --- Production stage ---
FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/game-engine/package.json packages/game-engine/
COPY packages/server/package.json packages/server/

RUN npm ci --omit=dev

# Copy compiled output from build stage
COPY --from=build /app/packages/game-engine/dist/ packages/game-engine/dist/
COPY --from=build /app/packages/server/dist/ packages/server/dist/

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "packages/server/dist/index.js"]
