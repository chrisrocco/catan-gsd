import type { FastifyPluginAsync } from 'fastify';
import { roomStore } from '../game/roomStore.js';

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async () => ({
    status: 'ok',
    rooms: roomStore.size,
    uptime: Math.floor(process.uptime()),
  }));
};

export default healthRoutes;
