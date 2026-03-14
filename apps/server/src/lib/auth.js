/**
 * requireAuth - Fastify preHandler hook for protecting routes that require authentication.
 *
 * Checks if request.session.userId exists.
 * If not, returns HTTP 401 with standard error response.
 * If yes, calls done() to proceed to the route handler.
 *
 * @param {object} request - Fastify request object
 * @param {object} reply - Fastify reply object
 * @param {Function} done - Callback to proceed
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
