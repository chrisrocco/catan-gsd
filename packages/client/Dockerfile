# --- Build stage ---
FROM node:22-slim AS build

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json tsconfig.json tsconfig.base.json ./

# Copy packages needed for the client build
COPY packages/game-engine/package.json packages/game-engine/tsconfig.json packages/game-engine/
COPY packages/client/package.json packages/client/tsconfig.json packages/client/vite.config.ts ./packages/client/

# Install all dependencies
RUN npm ci

# Copy source code
COPY packages/game-engine/src/ packages/game-engine/src/
COPY packages/client/src/ packages/client/src/
COPY packages/client/index.html packages/client/

# Build game-engine first (client depends on it), then client
RUN npm run build -w @catan/game-engine && npm run build -w @catan/client

# --- Production stage ---
FROM nginx:alpine

COPY --from=build /app/packages/client/dist/ /usr/share/nginx/html/

# SPA fallback: serve index.html for all routes
RUN printf 'server {\n  listen 80;\n  location / {\n    root /usr/share/nginx/html;\n    try_files $uri $uri/ /index.html;\n  }\n}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
