import PusherClient from 'pusher-js';

let client: PusherClient | null = null;

export function getPusherClient(): PusherClient {
  if (client) return client;

  const key = process.env.NEXT_PUBLIC_PUSHER_APP_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  if (!key || !cluster) {
    throw new Error("Pusher env missing (NEXT_PUBLIC_PUSHER_APP_KEY / NEXT_PUBLIC_PUSHER_CLUSTER)");
  }
  client = new PusherClient(key, {
    cluster,
    forceTLS: true,
    authEndpoint: '/api/pusher/auth',
  });

  return client;
}

export function disconnectPusherClient(): void {
  if (client) {
    client.disconnect();
    client = null;
  }
}
