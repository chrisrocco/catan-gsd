import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from '../types.js';

declare module 'fastify' {
  interface FastifyInstance {
    io: Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>;
  }
}

const socketioPluginImpl: FastifyPluginAsync = async (fastify) => {
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

// fastify-plugin breaks encapsulation so `fastify.io` is available on the root instance
export const socketioPlugin = fp(socketioPluginImpl, {
  name: 'socketio',
  fastify: '>=5',
});

export default socketioPlugin;
