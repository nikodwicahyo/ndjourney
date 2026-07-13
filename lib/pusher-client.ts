import PusherClient from 'pusher-js';

let client: PusherClient | null = null;

export function getPusherClient(): PusherClient {
  if (client) return client;

  client = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_APP_KEY!, {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
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
