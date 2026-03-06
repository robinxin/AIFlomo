export async function requireAuth(request, reply) {
  if (!request.session.userId) {
    return reply.status(401).send({
      data: null,
      error: 'UNAUTHORIZED',
      message: '请先登录',
    });
  }
}
