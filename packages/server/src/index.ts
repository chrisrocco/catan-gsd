import Fastify from 'fastify';
import { socketioPlugin } from './plugins/socketio.js';
import healthRoutes from './routes/health.js';
import roomRoutes from './routes/rooms.js';
import { registerLobbyHandlers } from './socket/lobbyHandlers.js';
// registerGameHandlers will be added in Plan 02-03

export async function build() {
  const app = Fastify({ logger: true });

  await app.register(socketioPlugin);
  await app.register(healthRoutes);
  await app.register(roomRoutes);

  app.io.on('connection', (socket) => {
    registerLobbyHandlers(app.io, socket);
    // registerGameHandlers(app.io, socket);  // Plan 02-03
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
