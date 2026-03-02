# --- Build stage ---
FROM node:22-slim AS build

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json tsconfig.json tsconfig.base.json ./

# Copy all three packages (manifests first for layer caching)
COPY packages/game-engine/package.json packages/game-engine/tsconfig.json packages/game-engine/
COPY packages/client/package.json packages/client/tsconfig.json packages/client/vite.config.ts packages/client/
COPY packages/server/package.json packages/server/tsconfig.json packages/server/

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY packages/game-engine/src/ packages/game-engine/src/
COPY packages/client/src/ packages/client/src/
COPY packages/client/index.html packages/client/
COPY packages/server/src/ packages/server/src/

# Build in dependency order: game-engine → client + server
RUN npm run build -w @catan/game-engine \
 && npm run build -w @catan/client \
 && npm run build -w @catan/server

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
COPY --from=build /app/packages/client/dist/ packages/client/dist/

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "packages/server/dist/index.js"]
