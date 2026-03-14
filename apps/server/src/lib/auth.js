/**
 * Authentication middleware for Fastify routes.
 *
 * Use as a preHandler hook to guard routes that require an authenticated session.
 *
 * @example
 * fastify.get('/protected', { preHandler: [requireAuth] }, handler)
 */

/**
 * Fastify preHandler middleware that enforces an authenticated session.
 *
 * Checks that `request.session` exists and that `request.session.userId`
 * is a truthy value. If either condition is not met, the request is rejected
 * immediately with HTTP 401 and a standardised error body.
 *
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply}   reply
 * @param {Function}                          done    - Call to continue to the next handler
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
