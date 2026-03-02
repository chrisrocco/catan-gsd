import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { existsSync } from 'node:fs';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { socketioPlugin } from './plugins/socketio.js';
import healthRoutes from './routes/health.js';
import roomRoutes from './routes/rooms.js';
import { registerLobbyHandlers } from './socket/lobbyHandlers.js';
import { registerGameHandlers } from './socket/gameHandlers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function build() {
  const app = Fastify({ logger: true });

  await app.register(socketioPlugin);
  await app.register(healthRoutes);
  await app.register(roomRoutes);

  // Serve client static files in production if the dist folder exists
  const clientDist = path.resolve(__dirname, '../../client/dist');
  if (existsSync(clientDist)) {
    await app.register(fastifyStatic, {
      root: clientDist,
      wildcard: false,
    });

    // SPA fallback: serve index.html for non-API routes
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api') || request.url.startsWith('/health')) {
        reply.code(404).send({ error: 'Not found' });
      } else {
        reply.sendFile('index.html');
      }
    });
  }

  app.io.on('connection', (socket) => {
    registerLobbyHandlers(app.io, socket);
    registerGameHandlers(app.io, socket);
  });

  return app;
}

export async function main() {
  const app = await build();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen({ port, host: '0.0.0.0' });
}

// Allow direct execution
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  main();
}
