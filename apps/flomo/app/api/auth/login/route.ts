import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { createSession, setSessionCookie, verifyPassword } from '../../../../lib/auth';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { email?: string; password?: string } | null;

  if (!body?.email || !body?.password) {
    return NextResponse.json({ error: '缺少参数' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user) {
    return NextResponse.json({ error: '账号不存在' }, { status: 404 });
  }

  const ok = await verifyPassword(body.password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: '密码错误' }, { status: 401 });
  }

  const session = await createSession(user.id);
  setSessionCookie(session.token);

  return NextResponse.json({ ok: true });
}
