import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../lib/prisma';
import { getSessionUserFromRequest } from '../../../lib/auth';
import { normalizeTags } from '../../../lib/validators';

export async function GET(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const type = req.nextUrl.searchParams.get('type');

  const where: Prisma.NoteWhereInput = { userId: user.id, deletedAt: null };
  if (type === 'notag') {
    where.tags = { none: {} };
  }

  const notes = await prisma.note.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      tags: { include: { tag: true } },
    },
  });

  return NextResponse.json({
    notes: notes.map((note) => ({
      ...note,
      tags: note.tags.map((t) => ({ id: t.tag.id, name: t.tag.name })),
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as { title?: string; content?: string; tags?: string[] } | null;
  if (!body?.content || !body.content.trim()) {
    return NextResponse.json({ error: '内容不能为空' }, { status: 400 });
  }

  const tags = normalizeTags(body.tags ?? []);

  const note = await prisma.note.create({
    data: {
      userId: user.id,
      title: body.title?.trim() || null,
      content: body.content.trim(),
      tags: {
        create: tags.map((name) => ({
          tag: {
            connectOrCreate: {
              where: { userId_name: { userId: user.id, name } },
              create: { userId: user.id, name },
            },
          },
        })),
      },
    },
    include: {
      tags: { include: { tag: true } },
    },
  });

  return NextResponse.json({
    note: {
      ...note,
      tags: note.tags.map((t) => ({ id: t.tag.id, name: t.tag.name })),
    },
  });
}
