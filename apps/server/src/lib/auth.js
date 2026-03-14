/**
 * requireAuth — Fastify preHandler 鉴权中间件
 *
 * 使用方式：
 *   fastify.get('/protected', { preHandler: [requireAuth] }, handler)
 *
 * 职责：
 *   - 检查 request.session.userId 是否存在
 *   - 不存在时返回 HTTP 401，拒绝访问
 *   - 存在时调用 done() 继续执行后续 handler
 *
 * 安全说明：
 *   - 使用可选链操作符 `?.` 防止 session 未初始化时抛出 TypeError
 *   - 错误信息不泄露技术细节（统一返回"请先登录"）
 */
export function requireAuth(request, reply, done) {
  if (!request.session?.userId) {
    return reply.code(401).send({
      data: null,
      error: '请先登录',
      message: '未授权访问',
    });
  }
  done();
}
