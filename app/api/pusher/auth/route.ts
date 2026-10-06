import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getPusherServer } from '@/lib/pusher-server';
import { prisma } from '@/lib/prisma';
import { withRateLimit } from '@/lib/rate-limit';

export async function POST(req: Request) {
  try {
    // SEC: channel-auth/socket enumeration must not be unthrottled.
    const rateCheck = await withRateLimit(req, { maxRequests: 60, windowSeconds: 3600, keyPrefix: "pusher-auth" });
    if (!rateCheck.allowed) {
      return rateCheck.response;
    }
    const session = rateCheck.session;

    const membership = await prisma.coupleMember.findUnique({
      where: { userId: session.user.id },
      select: { coupleId: true },
    });

    if (!membership) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    const formData = await req.formData();
    const socketId = formData.get('socket_id') as string;
    const channelName = formData.get('channel_name') as string;

    const expectedChannel = `private-couple-${membership.coupleId}`;
    if (channelName !== expectedChannel) {
      return new NextResponse('Forbidden Channel Target', { status: 403 });
    }

    const pusherServer = getPusherServer();
    if (!pusherServer) {
      return new NextResponse('Realtime not configured', { status: 503 });
    }
    const authResponse = pusherServer.authenticate(socketId, channelName);

    return NextResponse.json(authResponse);
  } catch (error) {
    console.error('[PUSHER_AUTH_ERROR]', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
