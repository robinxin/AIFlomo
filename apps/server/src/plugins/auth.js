/**
 * apps/server/src/plugins/auth.js
 *
 * 认证 preHandler。
 *
 * requireAuth 作为 Fastify 路由的 preHandler，检查 request.session.userId。
 * - userId 存在（truthy）：直接返回（不调用 reply.send），Fastify 继续后续 handler。
 * - userId 不存在（falsy 或 session 为 null/undefined）：立即返回 401，
 *   响应格式遵循统一 API 格式：{ data: null, error: 'Unauthorized', message: string }
 *
 * 注意：Fastify 5 中 async preHandler 不可接受 done 参数（会报错）。
 * 放行逻辑通过"不调用 reply.send 且正常返回"实现；
 * 拦截逻辑通过"调用 reply.send 并 return"实现。
 *
 * 用法：
 *   import { requireAuth } from '../plugins/auth.js';
 *   fastify.get('/api/memos', { preHandler: [requireAuth] }, handler);
 */

/**
 * requireAuth — 鉴权 preHandler（Fastify 5 async 风格，无 done 参数）
 *
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function requireAuth(request, reply) {
  const userId = request.session?.userId;

  if (!userId) {
    return reply.code(401).send({
      data: null,
      error: 'Unauthorized',
      message: 'Authentication required. Please log in.',
    });
  }

  // userId 存在，放行：async 函数正常返回即可，Fastify 继续后续 handler
}
