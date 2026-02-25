import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { getSessionUserFromRequest } from '../../../lib/auth';

export async function GET(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const tags = await prisma.tag.findMany({
    where: { userId: user.id },
    orderBy: { name: 'asc' },
    include: { notes: true },
  });

  return NextResponse.json({
    tags: tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      count: tag.notes.length,
    })),
  });
}
