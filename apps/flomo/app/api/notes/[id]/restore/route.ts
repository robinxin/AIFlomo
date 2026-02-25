import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { getSessionUserFromRequest } from '../../../../../lib/auth';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  // 恢复已软删除的笔记
  const result = await prisma.note.updateMany({
    where: { 
      id: params.id, 
      userId: user.id,
      deletedAt: { not: null } // 只恢复已标记为删除的笔记
    },
    data: { deletedAt: null }, // 清除删除标记
  });

  if (result.count === 0) {
    return NextResponse.json({ error: '笔记未找到或无法恢复' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}