import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestServer, connectClient, joinRoom, waitForEvent, connectAndWait } from './helpers.js';
import type { LobbyState } from '../types.js';
import type { TestClient } from './helpers.js';

// ---------------------------------------------------------------------------
// ROOM-01: Create room via REST
// ---------------------------------------------------------------------------
describe('ROOM-01: Create room via REST', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await createTestServer());
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /rooms returns 201 with 4-letter code and UUID playerId', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/rooms',
      body: { displayName: 'Alice' },
    });
    const body = response.json<{ code: string; playerId: string }>();
    expect(response.statusCode).toBe(201);
    expect(body.code).toMatch(/^[A-Z]{4}$/);
    expect(body.playerId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('GET /health returns status ok and room count', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    const body = response.json<{ status: string; rooms: number; uptime: number }>();
    expect(response.statusCode).toBe(200);
    expect(body.status).toBe('ok');
    expect(typeof body.rooms).toBe('number');
    expect(typeof body.uptime).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// ROOM-02: Join room via Socket.IO
// ---------------------------------------------------------------------------
describe('ROOM-02: Join room via Socket.IO', () => {
  let app: FastifyInstance;
  let port: number;
  let client: TestClient;

  beforeAll(async () => {
    ({ app, port } = await createTestServer());
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    if (client?.connected) client.disconnect();
  });

  it('join-room with valid code receives ok=true and lobby:state', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/rooms',
      body: { displayName: 'Alice' },
    });
    const { code } = createRes.json<{ code: string }>();

    client = connectClient(port);
    await connectAndWait(client);

    const statePromise = waitForEvent(client, 'lobby:state');
    const result = await joinRoom(client, code, 'Alice');

    expect(result.ok).toBe(true);
    expect(result.playerId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );

    const state = await statePromise as LobbyState;
    expect(state.code).toBe(code);
    expect(state.players).toHaveLength(1);
    expect(state.players[0]?.displayName).toBe('Alice');
    expect(state.players[0]?.isHost).toBe(true);
  });

  it('join-room with invalid code returns ok=false', async () => {
    client = connectClient(port);
    await connectAndWait(client);

    const result = await joinRoom(client, 'ZZZZ', 'Bob');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Room not found');
  });

  it('second player joining triggers lobby:state for both clients', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/rooms',
      body: { displayName: 'Alice' },
    });
    const { code } = createRes.json<{ code: string }>();

    const client1 = connectClient(port);
    const client2 = connectClient(port);

    try {
      await connectAndWait(client1);
      await connectAndWait(client2);

      await joinRoom(client1, code, 'Alice');

      // Listen for lobby:state on client1 when client2 joins
      const client1StatePromise = waitForEvent(client1, 'lobby:state');
      const client2StatePromise = waitForEvent(client2, 'lobby:state');

      await joinRoom(client2, code, 'Bob');

      const [client1State, client2State] = await Promise.all([
        client1StatePromise,
        client2StatePromise,
      ]) as [LobbyState, LobbyState];

      expect(client1State.players).toHaveLength(2);
      expect(client2State.players).toHaveLength(2);
    } finally {
      client1.disconnect();
      client2.disconnect();
    }
  });
});

// ---------------------------------------------------------------------------
// ROOM-03: Bot count configuration
// ---------------------------------------------------------------------------
describe('ROOM-03: Bot count configuration', () => {
  let app: FastifyInstance;
  let port: number;
  let hostClient: TestClient;
  let guestClient: TestClient;
  let roomCode: string;

  beforeAll(async () => {
    ({ app, port } = await createTestServer());
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    hostClient?.disconnect();
    guestClient?.disconnect();
  });

  async function setupRoom() {
    const createRes = await app.inject({
      method: 'POST',
      url: '/rooms',
      body: { displayName: 'Host' },
    });
    roomCode = createRes.json<{ code: string }>().code;

    hostClient = connectClient(port);
    await connectAndWait(hostClient);
    await joinRoom(hostClient, roomCode, 'Host');
  }

  it('host can set bot count and all clients receive updated lobby:state', async () => {
    await setupRoom();

    guestClient = connectClient(port);
    await connectAndWait(guestClient);

    // Set up listeners BEFORE the guest joins so we consume the join-triggered lobby:state
    const hostJoinStatePromise = waitForEvent(hostClient, 'lobby:state');
    const guestJoinStatePromise = waitForEvent(guestClient, 'lobby:state');
    await joinRoom(guestClient, roomCode, 'Guest');

    // Wait for both clients to receive the join lobby:state before proceeding
    await Promise.all([hostJoinStatePromise, guestJoinStatePromise]);

    // Now set up listeners for the bot count update
    const hostStatePromise = waitForEvent(hostClient, 'lobby:state');
    const guestStatePromise = waitForEvent(guestClient, 'lobby:state');

    hostClient.emit('set-bot-count', { count: 2 });

    const [hostState, guestState] = await Promise.all([
      hostStatePromise,
      guestStatePromise,
    ]) as [LobbyState, LobbyState];

    expect(hostState.botCount).toBe(2);
    expect(guestState.botCount).toBe(2);
  });

  it('non-host emitting set-bot-count receives room:error', async () => {
    await setupRoom();

    guestClient = connectClient(port);
    await connectAndWait(guestClient);
    await joinRoom(guestClient, roomCode, 'Guest');

    const errorPromise = waitForEvent(guestClient, 'room:error');
    guestClient.emit('set-bot-count', { count: 1 });

    const error = await errorPromise as { message: string };
    expect(error.message).toContain('host');
  });
});

// ---------------------------------------------------------------------------
// ROOM-04: Lobby state, start game, host migration
// ---------------------------------------------------------------------------
describe('ROOM-04: Lobby state broadcast and game start', () => {
  let app: FastifyInstance;
  let port: number;

  beforeAll(async () => {
    ({ app, port } = await createTestServer());
  });

  afterAll(async () => {
    await app.close();
  });

  it('all clients receive lobby:state when a player leaves', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/rooms',
      body: { displayName: 'Alice' },
    });
    const { code } = createRes.json<{ code: string }>();

    const client1 = connectClient(port);
    const client2 = connectClient(port);

    try {
      await connectAndWait(client1);
      await connectAndWait(client2);

      await joinRoom(client1, code, 'Alice');

      // Set up listeners BEFORE client2 joins to consume the join lobby:state
      const client1JoinPromise = waitForEvent(client1, 'lobby:state');
      const client2JoinPromise = waitForEvent(client2, 'lobby:state');
      await joinRoom(client2, code, 'Bob');

      // Wait for both to get the join state update
      await Promise.all([client1JoinPromise, client2JoinPromise]);

      // client2 disconnects — client1 should receive updated lobby:state
      const updatePromise = waitForEvent(client1, 'lobby:state');
      client2.disconnect();

      const state = await updatePromise as LobbyState;
      expect(state.players).toHaveLength(1);
      expect(state.players[0]?.displayName).toBe('Alice');
    } finally {
      client1.disconnect();
    }
  });

  it('host emitting start-game triggers game:state for all human players', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/rooms',
      body: { displayName: 'Alice' },
    });
    const { code } = createRes.json<{ code: string }>();

    const host = connectClient(port);
    const guest = connectClient(port);

    try {
      await connectAndWait(host);
      await connectAndWait(guest);

      await joinRoom(host, code, 'Alice');
      await joinRoom(guest, code, 'Bob');

      const hostGamePromise = waitForEvent(host, 'game:state');
      const guestGamePromise = waitForEvent(guest, 'game:state');

      host.emit('start-game');

      const [hostGameState, guestGameState] = await Promise.all([
        hostGamePromise,
        guestGamePromise,
      ]);

      expect(hostGameState).toHaveProperty('state');
      expect(hostGameState).toHaveProperty('events');
      expect(guestGameState).toHaveProperty('state');
    } finally {
      host.disconnect();
      guest.disconnect();
    }
  });

  it('non-host emitting start-game receives room:error', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/rooms',
      body: { displayName: 'Alice' },
    });
    const { code } = createRes.json<{ code: string }>();

    const host = connectClient(port);
    const guest = connectClient(port);

    try {
      await connectAndWait(host);
      await connectAndWait(guest);

      await joinRoom(host, code, 'Alice');
      await joinRoom(guest, code, 'Bob');

      const errorPromise = waitForEvent(guest, 'room:error');
      guest.emit('start-game');

      const error = await errorPromise as { message: string };
      expect(error.message).toContain('host');
    } finally {
      host.disconnect();
      guest.disconnect();
    }
  });

  it('when host disconnects, next player is promoted to host', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/rooms',
      body: { displayName: 'Alice' },
    });
    const { code } = createRes.json<{ code: string }>();

    const host = connectClient(port);
    const guest = connectClient(port);

    try {
      await connectAndWait(host);
      await connectAndWait(guest);

      await joinRoom(host, code, 'Alice');
      await joinRoom(guest, code, 'Bob');

      // Host disconnects — guest should become new host
      const updatePromise = waitForEvent(guest, 'lobby:state');
      host.disconnect();

      const state = await updatePromise as LobbyState;
      expect(state.players).toHaveLength(1);
      expect(state.players[0]?.displayName).toBe('Bob');
      expect(state.players[0]?.isHost).toBe(true);
    } finally {
      guest.disconnect();
    }
  });
});
