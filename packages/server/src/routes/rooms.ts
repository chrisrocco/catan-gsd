import type { FastifyPluginAsync } from 'fastify';
import { roomStore, getRoomCodes } from '../game/roomStore.js';
import { generateRoomCode } from '../game/roomCode.js';
import { RoomSession } from '../game/RoomSession.js';

interface CreateRoomBody {
  displayName: string;
}

const roomRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: CreateRoomBody }>('/rooms', async (request, reply) => {
    const code = generateRoomCode(getRoomCodes());
    const session = new RoomSession(code);
    roomStore.set(code, session);
    const playerId = crypto.randomUUID();
    return reply.status(201).send({ code, playerId });
  });
};

export default roomRoutes;
