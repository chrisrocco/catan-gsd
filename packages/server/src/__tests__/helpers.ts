import { io as createClient, type Socket } from 'socket.io-client';
import type { AddressInfo } from 'node:net';
import { build } from '../index.js';
import type { ServerToClientEvents, ClientToServerEvents } from '../types.js';

export type TestClient = Socket<ServerToClientEvents, ClientToServerEvents>;

export async function createTestServer() {
  const app = await build();
  await app.listen({ port: 0 }); // OS picks port
  const port = (app.server.address() as AddressInfo).port;
  return { app, port };
}

export function connectClient(port: number): TestClient {
  return createClient(`http://localhost:${port}`, {
    transports: ['websocket'],
    autoConnect: false,
  });
}

/** Helper: connect and join a room in one step */
export function joinRoom(
  client: TestClient,
  code: string,
  displayName: string,
): Promise<{ ok: boolean; playerId?: string; error?: string }> {
  return new Promise((resolve) => {
    client.emit('join-room', { code, displayName }, resolve);
  });
}

/** Helper: wait for next event of a specific type */
export function waitForEvent<K extends keyof ServerToClientEvents>(
  client: TestClient,
  event: K,
  timeout = 2000,
): Promise<Parameters<ServerToClientEvents[K]>[0]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout waiting for ${event}`)),
      timeout,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any).once(event, (data: unknown) => {
      clearTimeout(timer);
      resolve(data as Parameters<ServerToClientEvents[K]>[0]);
    });
  });
}

/** Helper: connect a client and wait for socket connection to be established */
export function connectAndWait(client: TestClient): Promise<void> {
  return new Promise((resolve, reject) => {
    client.once('connect', resolve);
    client.once('connect_error', reject);
    client.connect();
  });
}
