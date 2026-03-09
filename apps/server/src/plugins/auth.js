// requireAuth 认证中间件 — 校验 Session 有效性

/**
 * requireAuth - Fastify preHandler 中间件
 *
 * 用途：验证用户是否已登录（Session 中是否有 userId）
 * 使用方式：在需要认证的路由中添加 preHandler: [requireAuth]
 *
 * 如果 Session 有效，请求继续处理
 * 如果 Session 无效或不存在，返回 401 错误
 */
export async function requireAuth(request, reply) {
  // 检查 Session 中是否存在 userId
  if (!request.session.userId) {
    return reply.status(401).send({
      data: null,
      error: 'UNAUTHORIZED',
      message: '请先登录',
    });
  }

  // Session 有效，继续处理请求
  // 不需要显式调用 next()，Fastify 会自动继续执行下一个 handler
}
