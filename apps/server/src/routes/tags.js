import { requireAuth } from '../plugins/auth.js';
import { db } from '../db/index.js';
import { tags, memoTags, memos } from '../db/schema.js';
import { eq, and, isNull, count } from 'drizzle-orm';

export async function tagRoutes(fastify) {
  fastify.get('/', { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.session.userId;

    const rows = await db
      .select({
        id: tags.id,
        name: tags.name,
        createdAt: tags.createdAt,
        memoCount: count(memoTags.memoId),
      })
      .from(tags)
      .leftJoin(memoTags, eq(memoTags.tagId, tags.id))
      .leftJoin(memos, and(eq(memos.id, memoTags.memoId), isNull(memos.deletedAt)))
      .where(eq(tags.userId, userId))
      .groupBy(tags.id)
      .orderBy(tags.name);

    return reply.send({ data: rows, message: 'ok' });
  });
}
