import type { FastifyPluginAsync } from 'fastify';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from '../types.js';

declare module 'fastify' {
  interface FastifyInstance {
    io: Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>;
  }
}

export const socketioPlugin: FastifyPluginAsync = async (fastify) => {
  const io = new Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>(
    fastify.server,
    { cors: { origin: '*' } },
  );

  fastify.decorate('io', io);

  fastify.addHook('preClose', (done) => {
    io.close();
    done();
  });

  fastify.addHook('onClose', async () => {
    io.close();
  });
};

export default socketioPlugin;
