import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { createSession, hashPassword, setSessionCookie } from '../../../../lib/auth';
import { validateEmail, validatePassword } from '../../../../lib/validators';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { email?: string; password?: string; nickname?: string } | null;

  if (!body?.email || !body?.password) {
    return NextResponse.json({ error: '缺少参数' }, { status: 400 });
  }

  if (!validateEmail(body.email)) {
    return NextResponse.json({ error: '邮箱格式不正确' }, { status: 400 });
  }

  if (!validatePassword(body.password)) {
    return NextResponse.json({ error: '密码至少 6 位' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) {
    return NextResponse.json({ error: '邮箱已存在' }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      email: body.email,
      nickname: body.nickname ?? '',
      passwordHash: await hashPassword(body.password),
    },
  });

  const session = await createSession(user.id);
  setSessionCookie(session.token);

  return NextResponse.json({ ok: true });
}
