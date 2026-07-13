import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { pusherServer } from '@/lib/pusher-server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

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

    const authResponse = pusherServer.authenticate(socketId, channelName);

    return NextResponse.json(authResponse);
  } catch (error) {
    console.error('[PUSHER_AUTH_ERROR]', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
