import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { getSessionUserFromRequest } from '../../../lib/auth';

export async function GET(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const query = req.nextUrl.searchParams.get('q')?.trim();
  if (!query) {
    return NextResponse.json({ notes: [] });
  }

  const notes = await prisma.note.findMany({
    where: {
      userId: user.id,
      OR: [
        { content: { contains: query } },
        { title: { contains: query } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    include: { tags: { include: { tag: true } } },
  });

  return NextResponse.json({
    notes: notes.map((note) => ({
      ...note,
      tags: note.tags.map((t) => ({ id: t.tag.id, name: t.tag.name })),
    })),
  });
}
