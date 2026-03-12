import { db } from '../db/index.js';
import { tags, memoTags, memos } from '../db/schema.js';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { requireAuth } from '../plugins/auth.js';

async function tagsRoutes(fastify) {
  // GET /api/tags
  fastify.get('/', { preHandler: [requireAuth] }, async (request) => {
    const userId = request.session.userId;

    const rows = await db.all(sql`
      SELECT t.id, t.name, COUNT(mt.memo_id) as memoCount
      FROM tags t
      LEFT JOIN memo_tags mt ON mt.tag_id = t.id
      LEFT JOIN memos m ON m.id = mt.memo_id AND m.deleted_at IS NULL
      WHERE t.user_id = ${userId}
      GROUP BY t.id
      ORDER BY memoCount DESC
    `);

    return {
      data: rows.map((r) => ({
        id: r.id,
        name: r.name,
        memoCount: Number(r.memoCount),
      })),
      message: '获取成功',
    };
  });
}

export { tagsRoutes };
