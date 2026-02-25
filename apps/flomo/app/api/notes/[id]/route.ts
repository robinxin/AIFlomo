import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getSessionUserFromRequest } from '../../../../lib/auth';
import { normalizeTags } from '../../../../lib/validators';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as { title?: string; content?: string; tags?: string[] } | null;
  if (!body) {
    return NextResponse.json({ error: '缺少内容' }, { status: 400 });
  }

  const existing = await prisma.note.findFirst({
    where: { id: params.id, userId: user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: '未找到' }, { status: 404 });
  }

  const tags = normalizeTags(body.tags ?? []);

  const note = await prisma.note.update({
    where: { id: existing.id },
    data: {
      title: body.title?.trim() || null,
      content: body.content?.trim() ?? undefined,
      tags: {
        deleteMany: {},
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
    include: { tags: { include: { tag: true } } },
  });

  return NextResponse.json({
    note: {
      ...note,
      tags: note.tags.map((t) => ({ id: t.tag.id, name: t.tag.name })),
    },
  });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  await prisma.note.deleteMany({
    where: { id: params.id, userId: user.id },
  });

  return NextResponse.json({ ok: true });
}
