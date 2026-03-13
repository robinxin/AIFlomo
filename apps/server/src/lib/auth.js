/**
 * requireAuth — Fastify preHandler middleware
 *
 * Checks whether the current request has a valid session with userId.
 * Returns HTTP 401 if not authenticated; calls done() if authenticated.
 */
export function requireAuth(request, reply, done) {
  if (!request.session || !request.session.userId) {
    return reply.code(401).send({
      data: null,
      error: '请先登录',
      message: '未授权访问',
    });
  }
  done();
}
